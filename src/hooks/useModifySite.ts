import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PatchAction {
  path: string;
  type: 'replace' | 'insert-after' | 'insert-before';
  search?: string;
  content?: string;
}

interface UseModifySiteOptions {
  onMessage?: (message: string) => void;
  onPatch?: (actions: PatchAction[]) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onGenerationEvent?: (event: import('@/types/agent').GenerationEvent) => void;
}

export function useModifySite() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modifySite = async (
    message: string,
    relevantFiles: Array<{ path: string; content: string }>,
    sessionId: string,
    options: UseModifySiteOptions = {},
    complexity?: 'trivial' | 'simple' | 'moderate' | 'complex'
  ) => {
    setIsLoading(true);
    setIsStreaming(true);

    // Emit initial events like full generation
    options.onGenerationEvent?.({ type: 'analyze', message: 'Analyzing changes...', status: 'in-progress' });
    
    relevantFiles.forEach(file => {
      options.onGenerationEvent?.({ type: 'read', message: file.path, file: file.path, status: 'completed' });
    });

    const { data: { session } } = await supabase.auth.getSession();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Timeout de sécurité
    const safetyTimeout = setTimeout(() => {
      console.warn('⏱️ Timeout: Arrêt forcé modify-site après 30s');
      setIsStreaming(false);
      setIsLoading(false);
      options.onComplete?.();
    }, 30000); // 30s pour les modifications rapides

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-site`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            relevantFiles,
            sessionId,
            complexity: complexity || 'simple',
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Modify API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);

            switch (event.type) {
              case 'message':
                // Stream du message conversationnel
                options.onMessage?.(event.content);
                break;
              case 'complete':
                // Récupérer les actions de patch
                const { actions, message: finalMessage } = event.data;
                console.log('⚡ Modifications rapides reçues:', actions.length, 'actions');
                
                // Emit edit events for each patched file
                actions?.forEach((action: PatchAction) => {
                  options.onGenerationEvent?.({ 
                    type: 'edit', 
                    message: action.path, 
                    file: action.path,
                    status: 'completed'
                  });
                });
                
                clearTimeout(safetyTimeout);
                setIsStreaming(false);
                setIsLoading(false);
                
                // Appliquer les patches
                options.onPatch?.(actions);
                options.onGenerationEvent?.({ type: 'complete', message: 'Changes applied', status: 'completed' });
                options.onComplete?.();
                break;
              case 'error':
                throw new Error(event.data?.message || 'Modification error');
            }
          } catch (e) {
            console.error('Error parsing modify event:', e);
          }
        }
      }

      // Parse remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;
          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'complete') {
              clearTimeout(safetyTimeout);
              setIsStreaming(false);
              setIsLoading(false);
              options.onPatch?.(event.data?.actions || []);
              options.onComplete?.();
            }
          } catch (e) {
            console.error('Error parsing final modify event:', e);
          }
        }
      }

      clearTimeout(safetyTimeout);

    } catch (error: any) {
      clearTimeout(safetyTimeout);
      if (error.name !== 'AbortError') {
        console.error('Modify API error:', error);
        options.onError?.(error.message);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const abort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
    }
  };

  return {
    modifySite,
    abort,
    isLoading,
    isStreaming,
  };
}

/**
 * Applique un patch à un fichier
 */
export function applyPatch(
  fileContent: string,
  action: PatchAction
): string {
  const { type, search, content } = action;

  switch (type) {
    case 'replace':
      if (!search || !content) return fileContent;
      
      // Essayer d'abord le match exact
      let index = fileContent.indexOf(search);
      
      // Si échec, essayer avec fuzzy matching (normalisation des espaces)
      if (index === -1) {
        const normalizedContent = fileContent.replace(/\s+/g, ' ');
        const normalizedSearch = search.replace(/\s+/g, ' ');
        const fuzzyIndex = normalizedContent.indexOf(normalizedSearch);
        
        if (fuzzyIndex !== -1) {
          // Retrouver l'index original en comptant les caractères
          let charCount = 0;
          let originalIndex = 0;
          const contentNormalized = fileContent.replace(/\s+/g, ' ');
          
          for (let i = 0; i < fileContent.length && charCount < fuzzyIndex; i++) {
            if (fileContent[i].match(/\s/)) {
              if (contentNormalized[charCount] === ' ') charCount++;
            } else {
              charCount++;
            }
            originalIndex = i;
          }
          
          console.log('✅ Fuzzy match trouvé à l\'index:', originalIndex);
          index = originalIndex;
        }
      }
      
      if (index === -1) {
        console.warn('⚠️ Search string not found (exact + fuzzy):', search.substring(0, 100));
        console.warn('⚠️ Contexte fichier:', fileContent.substring(0, 200));
        return fileContent;
      }
      
      console.log('✅ Patch replace appliqué à l\'index:', index);
      return fileContent.substring(0, index) + content + fileContent.substring(index + search.length);

    case 'insert-after':
      if (!search || !content) return fileContent;
      const afterIndex = fileContent.indexOf(search);
      if (afterIndex === -1) {
        console.warn('⚠️ Search string not found for insert-after:', search.substring(0, 50));
        return fileContent;
      }
      return fileContent.substring(0, afterIndex + search.length) + '\n' + content + fileContent.substring(afterIndex + search.length);

    case 'insert-before':
      if (!search || !content) return fileContent;
      const beforeIndex = fileContent.indexOf(search);
      if (beforeIndex === -1) {
        console.warn('⚠️ Search string not found for insert-before:', search.substring(0, 50));
        return fileContent;
      }
      return fileContent.substring(0, beforeIndex) + content + '\n' + fileContent.substring(beforeIndex);

    default:
      console.warn('⚠️ Unknown patch type:', type);
      return fileContent;
  }
}
