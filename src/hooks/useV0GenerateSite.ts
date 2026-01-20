/**
 * useV0GenerateSite - Hook wrapper pour remplacer useGenerateSite par V0 API
 * 
 * Ce hook maintient la même interface que useGenerateSite mais utilise V0 API sous le capot.
 * Cela permet une migration progressive sans modifier BuilderSession.tsx
 */

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Local event type for V0
export interface V0GenerationEvent {
  type: string;
  phase?: string;
  message?: string;
  files?: string[];
  duration?: number;
}

export interface V0GenerateSiteParams {
  prompt: string;
  sessionId: string;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  projectType?: 'website' | 'webapp' | 'mobile';
}

export interface V0GenerateSiteResult {
  files: Record<string, string>;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  duration: number;
  projectName?: string;
}

export interface UseV0GenerateSiteOptions {
  onGenerationEvent?: (event: V0GenerationEvent) => void;
  onProjectName?: (name: string) => void;
  onProgress?: (content: string) => void;
  onFiles?: (files: Record<string, string>) => Promise<void> | void;
  onTokens?: (tokens: { input: number; output: number; total: number }) => void;
  onError?: (error: string) => void;
  onComplete?: (result: V0GenerateSiteResult) => Promise<void> | void;
}

export function useV0GenerateSite() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const generateSite = useCallback(async (
    params: V0GenerateSiteParams,
    options: UseV0GenerateSiteOptions = {}
  ): Promise<V0GenerateSiteResult | null> => {
    const { prompt, sessionId, attachedFiles, projectType = 'website' } = params;
    const { onGenerationEvent, onProjectName, onProgress, onFiles, onTokens, onError, onComplete } = options;

    setIsGenerating(true);
    setProgress('Connexion à V0...');
    startTimeRef.current = Date.now();

    abortControllerRef.current = new AbortController();

    // Emit initial events
    onGenerationEvent?.({ 
      type: 'progress', 
      phase: 'init', 
      message: 'Initialisation de la génération...' 
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Non authentifié');
      }

      // Phase: Analyzing
      onGenerationEvent?.({ 
        type: 'progress', 
        phase: 'analyzing', 
        message: 'Analyse de votre demande...' 
      });
      setProgress('Analyse de votre demande...');

      // Call v0-proxy
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/v0-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt,
            attachedFiles,
            projectType,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error(errorData.message || 'Limite quotidienne atteinte');
        }
        if (response.status === 402) {
          throw new Error(errorData.message || 'Crédits insuffisants');
        }
        throw new Error(errorData.error || `Erreur V0: ${response.status}`);
      }

      // Phase: Generating
      onGenerationEvent?.({ 
        type: 'progress', 
        phase: 'generating', 
        message: 'Génération du code...' 
      });
      setProgress('Génération du code...');

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let textBuffer = '';
      let accumulatedContent = '';
      let parsedFiles: Record<string, string> = {};
      let tokenData = { input: 0, output: 0, total: 0 };

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
            
            // Handle OpenAI-compatible streaming format
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              accumulatedContent += content;
              onProgress?.(accumulatedContent);
              
              // Emit progress event
              onGenerationEvent?.({ 
                type: 'progress', 
                phase: 'generating', 
                message: `Génération: ${accumulatedContent.length} caractères...` 
              });
            }

            // Handle usage data
            if (parsed.usage) {
              tokenData = {
                input: parsed.usage.prompt_tokens || 0,
                output: parsed.usage.completion_tokens || 0,
                total: parsed.usage.total_tokens || 0,
              };
            }
          } catch {
            // Incomplete JSON - put back and wait
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Parse files from accumulated content
      parsedFiles = parseFilesFromV0Response(accumulatedContent);
      
      // Ensure we have at least basic files
      if (Object.keys(parsedFiles).length === 0) {
        // Fallback: try to extract from the raw content
        parsedFiles = extractFallbackFiles(accumulatedContent);
      }

      const fileCount = Object.keys(parsedFiles).length;
      const duration = Date.now() - startTimeRef.current;

      if (fileCount === 0) {
        throw new Error('Aucun fichier généré');
      }

      // Phase: Files
      onGenerationEvent?.({ 
        type: 'files', 
        message: `${fileCount} fichiers créés`,
        files: Object.keys(parsedFiles)
      });
      setProgress(`${fileCount} fichiers créés`);

      // Notify about files
      if (onFiles) {
        await onFiles(parsedFiles);
      }

      // Notify about tokens
      onTokens?.(tokenData);

      // Generate project name
      try {
        const nameResponse = await supabase.functions.invoke('generate-project-name', {
          body: { prompt }
        });
        if (nameResponse.data?.projectName) {
          onProjectName?.(nameResponse.data.projectName);
          
          // Update session title
          await supabase
            .from('build_sessions')
            .update({ title: nameResponse.data.projectName })
            .eq('id', sessionId);
        }
      } catch (e) {
        console.warn('Could not generate project name:', e);
      }

      // Build result
      const result: V0GenerateSiteResult = {
        files: parsedFiles,
        tokens: tokenData,
        duration,
      };

      // Save to build session
      await supabase
        .from('build_sessions')
        .update({
          project_files: parsedFiles,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // Phase: Complete
      onGenerationEvent?.({ 
        type: 'complete', 
        message: `Site généré en ${Math.round(duration / 1000)}s`,
        duration
      });
      setProgress('Terminé !');

      if (onComplete) {
        await onComplete(result);
      }

      return result;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[useV0GenerateSite] Request aborted');
        setProgress('Annulé');
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('[useV0GenerateSite] Error:', errorMessage);
      
      onError?.(errorMessage);
      onGenerationEvent?.({ 
        type: 'error', 
        message: errorMessage 
      });
      setProgress('Échec');

      return null;

    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateSite,
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
    if (Object.keys(files).length > 0) break;
  }

  return files;
}

function extractFallbackFiles(content: string): Record<string, string> {
  const files: Record<string, string> = {};

  // Try to extract code blocks with language hints
  const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
  const cssMatch = content.match(/```css\n([\s\S]*?)```/);
  const jsMatch = content.match(/```(?:javascript|js)\n([\s\S]*?)```/);

  if (htmlMatch) files['index.html'] = htmlMatch[1].trim();
  if (cssMatch) files['styles.css'] = cssMatch[1].trim();
  if (jsMatch) files['app.js'] = jsMatch[1].trim();

  // If still no HTML, create a minimal one
  if (!files['index.html'] && content.includes('<html')) {
    const htmlStart = content.indexOf('<!DOCTYPE') !== -1 
      ? content.indexOf('<!DOCTYPE') 
      : content.indexOf('<html');
    const htmlEnd = content.lastIndexOf('</html>');
    
    if (htmlStart !== -1 && htmlEnd !== -1) {
      files['index.html'] = content.substring(htmlStart, htmlEnd + 7);
    }
  }

  return files;
}
