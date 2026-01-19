import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface V0ChatParams {
  prompt: string;
  chatId?: string;
  projectFiles?: Record<string, string>;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  projectType?: 'website' | 'webapp' | 'mobile';
}

export interface V0ChatResult {
  success: boolean;
  chatId: string;
  messageId: string;
  content: string;
  previewUrl?: string;
  files?: Record<string, string>;
  title?: string;
}

export interface UseV0ChatOptions {
  onProgress?: (content: string) => void;
  onComplete?: (result: V0ChatResult) => void;
  onError?: (error: string) => void;
  onPhase?: (phase: string) => void;
  streaming?: boolean;
}

export function useV0Chat() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    params: V0ChatParams,
    options: UseV0ChatOptions = {}
  ): Promise<V0ChatResult | null> => {
    const { prompt, chatId, projectFiles, attachedFiles, projectType = 'website' } = params;
    const { onProgress, onComplete, onError, onPhase, streaming = true } = options;

    setIsGenerating(true);
    setProgress('Connexion à V0...');
    onPhase?.('connecting');

    abortControllerRef.current = new AbortController();

    try {
      // Call our v0-proxy edge function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/v0-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            chatId,
            projectFiles,
            attachedFiles,
            projectType,
            stream: streaming,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error(errorData.message || 'Limite quotidienne atteinte. Inscrivez-vous pour plus de générations.');
        }
        if (response.status === 402) {
          throw new Error(errorData.message || 'Crédits insuffisants.');
        }
        throw new Error(errorData.error || 'Erreur de connexion à V0');
      }

      if (streaming && response.body) {
        // Handle SSE streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        let accumulatedContent = '';
        let resultData: Partial<V0ChatResult> = {};

        setProgress('Génération en cours...');
        onPhase?.('generating');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              
              // Handle different event types
              if (parsed.event === 'phase') {
                onPhase?.(parsed.phase);
                setProgress(parsed.message || parsed.phase);
              } else if (parsed.event === 'content') {
                accumulatedContent += parsed.content || '';
                onProgress?.(accumulatedContent);
              } else if (parsed.event === 'files') {
                resultData.files = parsed.files;
              } else if (parsed.event === 'complete') {
                resultData = { ...resultData, ...parsed };
              } else if (parsed.choices?.[0]?.delta?.content) {
                // OpenAI-compatible format
                const content = parsed.choices[0].delta.content;
                accumulatedContent += content;
                onProgress?.(accumulatedContent);
              }
            } catch {
              // Incomplete JSON, put back and wait
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }

        // Parse files from accumulated content if not already parsed
        const files = resultData.files || parseFilesFromV0Response(accumulatedContent);

        const result: V0ChatResult = {
          success: true,
          chatId: resultData.chatId || chatId || generateChatId(),
          messageId: resultData.messageId || generateMessageId(),
          content: accumulatedContent,
          files,
          previewUrl: resultData.previewUrl,
          title: resultData.title,
        };

        onComplete?.(result);
        setProgress('Terminé !');
        return result;

      } else {
        // Non-streaming mode
        const data = await response.json();
        
        const files = data.files || parseFilesFromV0Response(data.content || '');

        const result: V0ChatResult = {
          success: true,
          chatId: data.chatId || chatId || generateChatId(),
          messageId: data.messageId || generateMessageId(),
          content: data.content || data.choices?.[0]?.message?.content || '',
          files,
          previewUrl: data.previewUrl,
          title: data.title,
        };

        onComplete?.(result);
        setProgress('Terminé !');
        return result;
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[useV0Chat] Request aborted');
        setProgress('Annulé');
        return null;
      }
      
      console.error('[useV0Chat] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      onError?.(errorMessage);
      setProgress('Échec');
      return null;

    } finally {
      setIsGenerating(false);
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  return {
    sendMessage,
    abort,
    isGenerating,
    progress,
  };
}

// Helper functions
function parseFilesFromV0Response(content: string): Record<string, string> {
  const files: Record<string, string> = {};
  
  // Try multiple file marker patterns
  const patterns = [
    /\/\/ FILE: ([^\n]+)\n([\s\S]*?)(?=\/\/ FILE:|$)/g,
    /--- FILE: ([^\n]+) ---\n([\s\S]*?)(?=--- FILE:|$)/g,
    /<!-- FILE: ([^\n]+) -->\n([\s\S]*?)(?=<!-- FILE:|$)/g,
    /```(?:\w+)?\s*\/\/ ([^\n]+)\n([\s\S]*?)```/g,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1].trim();
      const fileContent = match[2].trim();
      if (path && fileContent) {
        files[path] = fileContent;
      }
    }
  }

  // If no files found, try to extract HTML/CSS/JS blocks
  if (Object.keys(files).length === 0) {
    // Look for code blocks with language hints
    const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
    const cssMatch = content.match(/```css\n([\s\S]*?)```/);
    const jsMatch = content.match(/```(?:javascript|js)\n([\s\S]*?)```/);

    if (htmlMatch) files['index.html'] = htmlMatch[1].trim();
    if (cssMatch) files['styles.css'] = cssMatch[1].trim();
    if (jsMatch) files['app.js'] = jsMatch[1].trim();
  }

  return files;
}

function generateChatId(): string {
  return `v0_chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMessageId(): string {
  return `v0_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
