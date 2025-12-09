import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export interface GenerationEvent {
  type: 'phase' | 'stream';
  phase?: 'analyze' | 'context' | 'generation' | 'validation';
  status?: 'starting' | 'complete';
  message?: string;
  chunk?: string;
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
  tokens: TokensData;
  duration: number;
  analysis: AnalysisData;
}

export interface UseUnifiedModifyOptions {
  onIntentMessage?: (message: string) => void;
  onGenerationEvent?: (event: GenerationEvent) => void;
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
    const { message, projectFiles, sessionId, memory } = params;
    const { 
      onIntentMessage, 
      onGenerationEvent, 
      onASTModifications, 
      onTokens, 
      onError,
      onComplete 
    } = options;

    setIsLoading(true);
    setIsStreaming(true);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Security timeout: 120 seconds
    timeoutRef.current = window.setTimeout(() => {
      console.warn('[useUnifiedModify] Request timeout after 120 seconds');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      onError?.('Request timeout after 120 seconds');
    }, 120000);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Build request URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not configured');
      }
      const url = `${supabaseUrl}/functions/v1/unified-modify`;

      console.log('[useUnifiedModify] Starting request:', {
        messageLength: message.length,
        fileCount: Object.keys(projectFiles).length,
        sessionId,
        hasMemory: !!memory,
      });

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          projectFiles,
          sessionId,
          memory,
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

      // Parse SSE stream
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

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines to get complete events
        const events = buffer.split('\n\n');
        
        // Keep last incomplete event in buffer
        buffer = events.pop() || '';

        // Process complete events
        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const lines = eventStr.split('\n');
          let eventName = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (!eventName || !eventData) continue;

          try {
            const data = JSON.parse(eventData);

            switch (eventName) {
              case 'generation_event':
                console.log('[useUnifiedModify] Generation event:', data);
                onGenerationEvent?.(data as GenerationEvent);
                break;

              case 'message':
                console.log('[useUnifiedModify] Message:', data.content);
                onIntentMessage?.(data.content || data.message);
                break;

              case 'tokens':
                console.log('[useUnifiedModify] Tokens:', data);
                onTokens?.(data as TokensData);
                break;

              case 'complete':
                console.log('[useUnifiedModify] Complete:', {
                  success: data.success,
                  modifications: data.modifications?.length,
                  duration: data.duration,
                });
                finalResult = data as CompleteResult;
                
                if (data.modifications && data.updatedFiles) {
                  await onASTModifications?.(data.modifications, data.updatedFiles);
                }
                onComplete?.(data);
                break;

              case 'error':
                console.error('[useUnifiedModify] Error event:', data);
                onError?.(data.message || 'Unknown error');
                break;

              default:
                console.log('[useUnifiedModify] Unknown event:', eventName, data);
            }
          } catch (parseError) {
            console.error('[useUnifiedModify] Failed to parse event data:', parseError, eventData);
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        let eventName = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        if (eventName && eventData) {
          try {
            const data = JSON.parse(eventData);
            if (eventName === 'complete') {
              finalResult = data as CompleteResult;
              if (data.modifications && data.updatedFiles) {
                await onASTModifications?.(data.modifications, data.updatedFiles);
              }
              onComplete?.(data);
            }
          } catch (e) {
            console.error('[useUnifiedModify] Failed to parse final buffer:', e);
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
