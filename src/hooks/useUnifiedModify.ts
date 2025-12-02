import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface UnifiedModifyOptions {
  onGenerationEvent?: (event: {
    type: 'analyze' | 'edit' | 'complete' | 'error';
    message: string;
    status?: 'pending' | 'in-progress' | 'completed' | 'error';
    duration?: number;
  }) => void;
  onMessage?: (content: string) => void;
  onASTModifications?: (modifications: any[]) => void;
  onTokens?: (tokens: { input_tokens: number; output_tokens: number; total_tokens: number }) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export interface ASTModification {
  path: string;
  fileType: 'css' | 'html' | 'js' | 'jsx';
  type: 'update' | 'insert' | 'delete' | 'replace';
  target: any;
  value?: string;
}

export function useUnifiedModify() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modifySite = async (
    message: string,
    projectFiles: Record<string, string>,
    sessionId: string,
    complexity: 'trivial' | 'simple' | 'complex',
    memory: any | null,
    options: UnifiedModifyOptions
  ) => {
    setIsLoading(true);
    setIsStreaming(true);

    // Create abort controller pour pouvoir annuler
    abortControllerRef.current = new AbortController();

    // Safety timeout (120s)
    const safetyTimeout = setTimeout(() => {
      console.warn('⏱️ Timeout: Arrêt forcé après 120s');
      setIsStreaming(false);
      setIsLoading(false);

      // NE PAS appeler onComplete ici - c'est une erreur !
      options.onError?.(
        'Délai dépassé - La génération a pris trop de temps. Veuillez réessayer avec une demande plus simple.'
      );

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 120000);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session found');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-modify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message,
            projectFiles,
            sessionId,
            complexity,
            memory
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      // Stream SSE
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let modifications: ASTModification[] = [];
      let finalMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);

            switch (event.type) {
              case 'generation_event':
                // Événements de génération (analyze, edit, complete, error)
                if (event.event) {
                  options.onGenerationEvent?.(event.event);
                }
                break;

              case 'message':
                // Message conversationnel streamé
                if (event.content) {
                  options.onMessage?.(event.content);
                }
                break;

              case 'tokens':
                // Tokens usage
                options.onTokens?.({
                  input_tokens: event.input_tokens || 0,
                  output_tokens: event.output_tokens || 0,
                  total_tokens: event.total_tokens || 0
                });
                break;

              case 'complete':
                // Génération complète avec modifications validées
                if (event.data) {
                  modifications = event.data.modifications || [];
                  finalMessage = event.data.message || '';

                  console.log(`[useUnifiedModify] ✅ Received ${modifications.length} validated modifications`);

                  // IMPORTANT: Appeler onASTModifications AVANT onComplete
                  // Le client doit valider et appliquer les modifications
                  // Et seulement APRÈS appeler onComplete si tout réussit
                  if (modifications.length > 0) {
                    options.onASTModifications?.(modifications);
                  }
                }
                break;

              case 'error':
                // Erreur de génération
                const errorMsg = event.data?.message || 'Erreur inconnue';
                console.error('[useUnifiedModify] ❌ Error:', errorMsg);
                options.onError?.(errorMsg);
                break;
            }
          } catch (parseError) {
            console.error('[useUnifiedModify] Parse error:', parseError);
          }
        }
      }

      clearTimeout(safetyTimeout);
      setIsStreaming(false);
      setIsLoading(false);

      // NOTE: onComplete() est appelé par le client APRÈS application réussie
      // Pas ici ! C'est la clé pour éviter le bug "completed trop tôt"

    } catch (error: any) {
      clearTimeout(safetyTimeout);
      setIsStreaming(false);
      setIsLoading(false);

      if (error.name === 'AbortError') {
        console.log('[useUnifiedModify] Request aborted');
        return;
      }

      console.error('[useUnifiedModify] Error:', error);
      options.onError?.(error.message || 'Erreur lors de la modification');
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
    isStreaming
  };
}
