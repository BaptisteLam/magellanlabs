import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ASTModification } from '@/types/ast';

interface UseUnifiedModifyOptions {
  onMessage?: (message: string) => void;
  onASTModifications?: (modifications: ASTModification[]) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onGenerationEvent?: (event: import('@/types/agent').GenerationEvent) => void;
  onTokens?: (tokens: { input: number; output: number; total: number }) => void;
  onIntentMessage?: (message: string) => void;
}

export function useUnifiedModify() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const unifiedModify = async (
    message: string,
    projectFiles: Record<string, string>,
    sessionId: string,
    memory: any | null,
    options: UseUnifiedModifyOptions = {}
  ) => {
    setIsLoading(true);
    setIsStreaming(true);
    startTimeRef.current = Date.now();

    // Émettre événement thought au démarrage
    options.onGenerationEvent?.({
      type: 'thought',
      message: 'Analyzing request...',
      status: 'in-progress'
    });

    const { data: { session } } = await supabase.auth.getSession();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Timeout de sécurité
    const safetyTimeout = setTimeout(() => {
      console.error('⏱️ Timeout: Arrêt forcé unified-modify après 120s');
      setIsStreaming(false);
      setIsLoading(false);
      options.onGenerationEvent?.({
        type: 'error',
        message: 'Modification timeout (120s)',
        status: 'error'
      });
      options.onError?.('Modification timed out after 120 seconds');
    }, 120000); // 120s

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            projectFiles,
            sessionId,
            memory,
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Unified Modify API error: ${response.status}`);
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
              case 'generation_event':
                // Événements de progression
                options.onGenerationEvent?.(event.event);

                // Si complete, appliquer les modifications
                if (event.event?.type === 'complete') {
                  const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

                  options.onGenerationEvent?.({
                    type: 'thought',
                    message: `Request analyzed`,
                    status: 'completed',
                    duration
                  });
                }
                break;

              case 'message':
                // Stream du message conversationnel
                options.onMessage?.(event.content);
                break;

              case 'tokens':
                // Émettre les tokens
                console.log('💰 Tokens reçus:', event);
                options.onTokens?.({
                  input: event.input_tokens || 0,
                  output: event.output_tokens || 0,
                  total: event.total_tokens || 0
                });
                break;

              case 'complete':
                // Récupérer les modifications AST
                const { modifications, message: finalMessage } = event.data;
                console.log('⚡ Modifications AST reçues:', modifications?.length || 0);
                console.log('💬 Message final:', finalMessage);

                const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

                options.onGenerationEvent?.({
                  type: 'thought',
                  message: `Thought for ${duration}s`,
                  status: 'completed',
                  duration
                });

                // Transmettre le message
                if (finalMessage) {
                  options.onIntentMessage?.(finalMessage);
                }

                // Emit edit events
                modifications?.forEach((mod: ASTModification) => {
                  options.onGenerationEvent?.({
                    type: 'edit',
                    message: mod.path,
                    file: mod.path,
                    status: 'completed'
                  });
                });

                clearTimeout(safetyTimeout);
                setIsStreaming(false);
                setIsLoading(false);

                // Appliquer les modifications AST
                options.onASTModifications?.(modifications || []);
                options.onGenerationEvent?.({
                  type: 'complete',
                  message: 'Changes applied',
                  status: 'completed'
                });
                options.onComplete?.();
                break;

              case 'error':
                throw new Error(event.data?.message || 'Modification error');
            }
          } catch (e) {
            console.error('Error parsing event:', e);
          }
        }
      }

      clearTimeout(safetyTimeout);

    } catch (error: any) {
      clearTimeout(safetyTimeout);
      if (error.name !== 'AbortError') {
        console.error('Unified Modify error:', error);
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
    unifiedModify,
    abort,
    isLoading,
    isStreaming,
  };
}
