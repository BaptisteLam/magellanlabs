import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GenerationEvent } from '@/types/agent';

// ============= Types =============

export interface ASTModification {
  type: 'css-change' | 'html-change' | 'jsx-change';
  path: string;
  target?: string;
  property?: string;
  attribute?: string;
  value?: string;
  changes?: Record<string, string>;
}

export interface FileAffected {
  path: string;
  description: string;
  changeType: 'modified' | 'created' | 'deleted';
}

// Backend SSE event format (before mapping to GenerationEvent)
interface SSEGenerationEvent {
  type: 'phase' | 'stream' | 'file_identified' | 'file_modified';
  phase?: 'analyze' | 'context' | 'generation' | 'validation';
  status?: 'starting' | 'complete';
  message?: string;
  chunk?: string;
  file?: string;
  description?: string;
  changeType?: string;
  data?: any;
}

export interface TokensData {
  input: number;
  output: number;
  total: number;
}

export interface AnalysisData {
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  intentType: 'quick-modification' | 'full-generation';
  confidence: number;
  explanation: string;
}

export interface CompleteResult {
  success: boolean;
  modifications: ASTModification[];
  updatedFiles: Record<string, string>;
  message: string;
  intentMessage?: string;
  filesAffected?: FileAffected[];
  tokens: TokensData;
  duration: number;
  analysis: AnalysisData;
}

export interface UseUnifiedModifyOptions {
  onIntentMessage?: (message: string) => void;
  onGenerationEvent?: (event: SSEGenerationEvent) => void;
  onFileModified?: (file: string, description: string) => void;
  onASTModifications?: (modifications: ASTModification[], updatedFiles: Record<string, string>) => Promise<void>;
  onTokens?: (tokens: TokensData) => void;
  onError?: (error: string) => void;
  onComplete?: (result: CompleteResult) => void;
}

export interface UnifiedModifyParams {
  message: string;
  projectFiles: Record<string, string>;
  sessionId: string;
  memory?: any;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// ============= Hook =============

export function useUnifiedModify() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const unifiedModify = useCallback(async (
    params: UnifiedModifyParams,
    options: UseUnifiedModifyOptions = {}
  ): Promise<CompleteResult | null> => {
    const { message, projectFiles, sessionId } = params;
    const {
      onIntentMessage,
      onGenerationEvent,
      onFileModified,
      onASTModifications,
      onTokens,
      onError,
      onComplete
    } = options;

    setIsLoading(true);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    // Timeout: 180 seconds (v0 API can take longer)
    timeoutRef.current = window.setTimeout(() => {
      console.warn('[useUnifiedModify] Request timeout after 180 seconds');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      onError?.('Request timeout after 180 seconds');
    }, 180000);

    const startTime = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not configured');
      }

      // Récupérer le v0_chat_id de la session pour faire un follow-up
      const { data: buildSession } = await supabase
        .from('build_sessions')
        .select('v0_chat_id')
        .eq('id', sessionId)
        .maybeSingle();

      const v0ChatId = buildSession?.v0_chat_id;

      // Utiliser v0-chat avec isFollowUp si on a un chatId existant
      const url = `${supabaseUrl}/functions/v1/v0-chat`;

      console.log('[useUnifiedModify] Starting v0 request:', {
        messageLength: message.length,
        fileCount: Object.keys(projectFiles).length,
        sessionId,
        isFollowUp: !!v0ChatId,
        v0ChatId,
      });

      // Émettre l'événement d'analyse
      onGenerationEvent?.({
        type: 'phase',
        phase: 'analyze',
        status: 'starting',
        message: 'Analyse de la demande via v0...',
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: message,
          sessionId,
          chatId: v0ChatId || undefined,
          isFollowUp: !!v0ChatId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Parse SSE stream from v0-chat edge function
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: CompleteResult | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[useUnifiedModify] Stream completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const lines = eventStr.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6);

            try {
              const data = JSON.parse(dataStr);

              switch (data.type) {
                case 'start':
                  console.log('[useUnifiedModify] v0 chat started:', data.data);
                  onIntentMessage?.('Modification en cours via v0 Platform...');
                  break;

                case 'generation_event':
                  console.log('[useUnifiedModify] Generation event:', data.data);
                  onGenerationEvent?.(data.data as SSEGenerationEvent);

                  if (data.data?.type === 'file_modified' && data.data?.file) {
                    onFileModified?.(data.data.file, data.data.description || '');
                  }
                  if (data.data?.type === 'create' && data.data?.file) {
                    onFileModified?.(data.data.file, data.data.message || 'Created');
                  }
                  break;

                case 'files':
                  if (data.data?.files) {
                    console.log('[useUnifiedModify] Files received:', Object.keys(data.data.files).length);

                    // Calculer les modifications par rapport aux fichiers existants
                    const modifications: ASTModification[] = [];
                    const updatedFiles = data.data.files as Record<string, string>;

                    for (const [path, content] of Object.entries(updatedFiles)) {
                      if (!projectFiles[path]) {
                        modifications.push({ type: 'html-change', path, changes: { created: 'true' } });
                        onFileModified?.(path, 'Fichier créé');
                      } else if (projectFiles[path] !== content) {
                        modifications.push({ type: 'html-change', path, changes: { modified: 'true' } });
                        onFileModified?.(path, 'Fichier modifié');
                      }
                    }

                    // Appeler onASTModifications avec les fichiers mis à jour
                    if (modifications.length > 0) {
                      await onASTModifications?.(modifications, updatedFiles);
                    }
                  }
                  break;

                case 'preview':
                  console.log('[useUnifiedModify] Preview URL:', data.data?.url);
                  break;

                case 'credits':
                  console.log('[useUnifiedModify] Credits:', data.data);
                  break;

                case 'complete':
                  console.log('[useUnifiedModify] Complete:', data.data);

                  const duration = Date.now() - startTime;
                  const completedFiles = data.data?.files || {};

                  // Construire les modifications
                  const finalModifications: ASTModification[] = [];
                  const filesAffected: FileAffected[] = [];

                  for (const path of Object.keys(completedFiles)) {
                    if (!projectFiles[path]) {
                      finalModifications.push({ type: 'html-change', path });
                      filesAffected.push({ path, description: 'Created', changeType: 'created' });
                    } else if (projectFiles[path] !== completedFiles[path]) {
                      finalModifications.push({ type: 'html-change', path });
                      filesAffected.push({ path, description: 'Modified', changeType: 'modified' });
                    }
                  }

                  finalResult = {
                    success: true,
                    modifications: finalModifications,
                    updatedFiles: completedFiles,
                    message: 'Modifications appliquées via v0 Platform',
                    intentMessage: 'Modification via v0',
                    filesAffected,
                    tokens: data.data?.tokens || { input: 0, output: 0, total: 0 },
                    duration,
                    analysis: {
                      complexity: 'moderate',
                      intentType: 'quick-modification',
                      confidence: 90,
                      explanation: 'Modified via v0 Platform API',
                    },
                  };

                  onTokens?.(finalResult.tokens);
                  onComplete?.(finalResult);
                  break;

                case 'error':
                  console.error('[useUnifiedModify] Error:', data.data);
                  onError?.(data.data?.message || 'Unknown error');
                  break;
              }
            } catch (parseError) {
              console.error('[useUnifiedModify] Failed to parse event:', parseError, dataStr);
            }
          }
        }
      }

      return finalResult;

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('[useUnifiedModify] Request aborted');
        } else {
          console.error('[useUnifiedModify] Error:', error);
          onError?.(error.message);
        }
      } else {
        console.error('[useUnifiedModify] Unknown error:', error);
        onError?.('Unknown error occurred');
      }
      return null;

    } finally {
      setIsLoading(false);
      setIsStreaming(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      abortControllerRef.current = null;
    }
  }, []);

  return {
    unifiedModify,
    abort,
    isLoading,
    isStreaming,
  };
}

export default useUnifiedModify;
