/**
 * useV0UnifiedModify - Hook wrapper pour remplacer useUnifiedModify par V0 API
 * 
 * Ce hook maintient la même interface que useUnifiedModify mais utilise V0 API sous le capot.
 * Cela permet une migration progressive sans modifier BuilderSession.tsx
 */

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ASTModification } from '@/types/ast';

export interface V0UnifiedModifyParams {
  message: string;
  projectFiles: Record<string, string>;
  memory?: any;
  conversationHistory?: Array<{ role: string; content: string }>;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
}

export interface V0UnifiedModifyOptions {
  onGenerationEvent?: (event: any) => void;
  onComplete?: (result: V0UnifiedModifyResult) => void;
  onError?: (error: string) => void;
}

export interface V0UnifiedModifyResult {
  success: boolean;
  modifications: ASTModification[];
  filesAffected: string[];
  newFiles: Record<string, string>;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  duration: number;
  message?: string;
}

export function useV0UnifiedModify() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  const unifiedModify = useCallback(async (
    params: V0UnifiedModifyParams,
    options: V0UnifiedModifyOptions = {}
  ): Promise<V0UnifiedModifyResult | null> => {
    const { message, projectFiles, memory, conversationHistory, attachedFiles } = params;
    const { onGenerationEvent, onComplete, onError } = options;

    setIsLoading(true);
    setIsStreaming(false);

    const startTime = Date.now();
    abortControllerRef.current = new AbortController();

    // Emit init event
    onGenerationEvent?.({ 
      type: 'progress', 
      phase: 'init', 
      message: 'Initialisation de la modification...' 
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Non authentifié');
      }

      // Build context prompt with existing files
      const contextPrompt = buildModificationPrompt(message, projectFiles, memory);

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
            prompt: contextPrompt,
            projectFiles,
            attachedFiles,
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
        throw new Error(errorData.error || `Erreur V0: ${response.status}`);
      }

      setIsStreaming(true);
      onGenerationEvent?.({ 
        type: 'progress', 
        phase: 'generating', 
        message: 'Génération des modifications...' 
      });

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let textBuffer = '';
      let accumulatedContent = '';
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
            
            if (parsed.choices?.[0]?.delta?.content) {
              accumulatedContent += parsed.choices[0].delta.content;
            }

            if (parsed.usage) {
              tokenData = {
                input: parsed.usage.prompt_tokens || 0,
                output: parsed.usage.completion_tokens || 0,
                total: parsed.usage.total_tokens || 0,
              };
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Parse the generated modifications
      const parsedFiles = parseFilesFromContent(accumulatedContent);
      const duration = Date.now() - startTime;

      // Merge with existing files
      const newFiles: Record<string, string> = {};
      const filesAffected: string[] = [];

      for (const [path, content] of Object.entries(parsedFiles)) {
        if (projectFiles[path] !== content) {
          newFiles[path] = content;
          filesAffected.push(path);
        }
      }

      // Create AST modifications for compatibility
      const modifications: ASTModification[] = filesAffected.map(path => ({
        type: (projectFiles[path] ? 'style-change' : 'jsx-change') as ASTModification['type'],
        path,
        filePath: path,
        fileType: path.endsWith('.css') ? 'css' : path.endsWith('.html') ? 'html' : 'jsx',
        target: path,
        content: newFiles[path],
        changes: {},
      }));

      const result: V0UnifiedModifyResult = {
        success: true,
        modifications,
        filesAffected,
        newFiles,
        tokens: tokenData,
        duration,
        message: extractMessageFromContent(accumulatedContent),
      };

      onGenerationEvent?.({ 
        type: 'complete', 
        message: `${filesAffected.length} fichiers modifiés en ${Math.round(duration / 1000)}s`,
        duration
      });

      onComplete?.(result);
      return result;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[useV0UnifiedModify] Request aborted');
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('[useV0UnifiedModify] Error:', errorMessage);
      
      onError?.(errorMessage);
      onGenerationEvent?.({ type: 'error', message: errorMessage });

      return null;

    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);

  return {
    unifiedModify,
    abort,
    isLoading,
    isStreaming,
  };
}

// Helper functions
function buildModificationPrompt(
  message: string, 
  projectFiles: Record<string, string>,
  memory?: any
): string {
  const filesList = Object.keys(projectFiles).join('\n');
  const filesContext = Object.entries(projectFiles)
    .map(([path, content]) => `// FILE: ${path}\n${content}`)
    .join('\n\n---\n\n');

  let prompt = `Tu dois modifier un projet web existant selon cette demande:

**DEMANDE:** ${message}

**FICHIERS EXISTANTS:**
${filesList}

**CONTENU DES FICHIERS:**
${filesContext}

**INSTRUCTIONS:**
- Retourne UNIQUEMENT les fichiers modifiés avec le format "// FILE: chemin/fichier.ext"
- Conserve la structure et le style du code existant
- N'ajoute pas de fichiers non demandés
- Applique les modifications de manière ciblée`;

  if (memory?.architecture) {
    prompt += `\n\n**CONTEXTE DU PROJET:**
${JSON.stringify(memory.architecture, null, 2)}`;
  }

  return prompt;
}

function parseFilesFromContent(content: string): Record<string, string> {
  const files: Record<string, string> = {};
  
  const fileRegex = /\/\/ FILE: ([^\n]+)\n([\s\S]*?)(?=\/\/ FILE:|$)/g;
  
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const path = match[1].trim();
    const fileContent = match[2].trim();
    if (path && fileContent) {
      files[path] = fileContent;
    }
  }

  // Fallback: try code blocks
  if (Object.keys(files).length === 0) {
    const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
    const cssMatch = content.match(/```css\n([\s\S]*?)```/);
    const jsMatch = content.match(/```(?:javascript|js)\n([\s\S]*?)```/);

    if (htmlMatch) files['index.html'] = htmlMatch[1].trim();
    if (cssMatch) files['styles.css'] = cssMatch[1].trim();
    if (jsMatch) files['app.js'] = jsMatch[1].trim();
  }

  return files;
}

function extractMessageFromContent(content: string): string {
  // Try to extract explanation or message from content
  const explanationMatch = content.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
  if (explanationMatch) {
    return explanationMatch[1].trim();
  }

  const messageMatch = content.match(/\[MESSAGE\]([\s\S]*?)\[\/MESSAGE\]/);
  if (messageMatch) {
    return messageMatch[1].trim();
  }

  // Return first line if it looks like a message
  const firstLine = content.split('\n')[0];
  if (firstLine && !firstLine.startsWith('//') && !firstLine.startsWith('<') && !firstLine.startsWith('{')) {
    return firstLine.substring(0, 200);
  }

  return 'Modifications appliquées avec succès';
}
