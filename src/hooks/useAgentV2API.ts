import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectMemory } from './useProjectMemory';

// Configuration du retry avec backoff exponentiel
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

interface UseAgentV2Options {
  onPhase?: (phase: string) => void;
  onExploration?: (data: any) => void;
  onStatus?: (status: string) => void;
  onMessage?: (message: string) => void;
  onLog?: (log: string) => void;
  onIntent?: (intent: any) => void;
  onCodeUpdate?: (path: string, code: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onGenerationEvent?: (event: import('@/types/agent').GenerationEvent) => void;
  onTokens?: (tokens: { input: number; output: number; total: number }) => void;
}

export function useAgentV2API() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const filesInProgressRef = useRef<Set<string>>(new Set());

  const callAgentV2 = async (
    message: string,
    projectFiles: Record<string, string>,
    memory: ProjectMemory | null,
    sessionId: string,
    projectType: string = 'webapp',
    attachedFiles: Array<{ name: string; base64: string; type: string }> = [],
    options: UseAgentV2Options = {}
  ) => {
    setIsLoading(true);
    setIsStreaming(true);

    const { data: { session } } = await supabase.auth.getSession();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Track thinking time and emit initial planning event
    const thinkStart = Date.now();
    options.onGenerationEvent?.({ type: 'thought', message: 'Analyzing your request...', status: 'in-progress' });

    // Timeout de sécurité
    const safetyTimeout = setTimeout(() => {
      console.warn('⏱️ Timeout: Arrêt forcé agent-v2 après 120s');
      setIsStreaming(false);
      setIsLoading(false);
      options.onComplete?.();
      options.onGenerationEvent?.({ type: 'complete', message: 'Generation completed (timeout)' });
    }, 120000);

    // Fonction de retry avec backoff exponentiel
    const fetchWithRetry = async (attemptNumber: number = 0): Promise<Response> => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-v2`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message,
              projectFiles,
              memory,
              sessionId,
              projectType,
              attachedFiles,
            }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attemptNumber < RETRY_CONFIG.maxRetries) {
            const delay = Math.min(
              RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber),
              RETRY_CONFIG.maxDelay
            );
            
            console.warn(`⚠️ Request failed (status ${response.status}), retrying in ${delay}ms (attempt ${attemptNumber + 1}/${RETRY_CONFIG.maxRetries})...`);
            options.onMessage?.(`Retry in progress (${attemptNumber + 1}/${RETRY_CONFIG.maxRetries})...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(attemptNumber + 1);
          }
          
          throw new Error(`Agent-v2 API error: ${response.status}`);
        }

        return response;
      } catch (error: any) {
        if (attemptNumber < RETRY_CONFIG.maxRetries && error.name !== 'AbortError') {
          const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber),
            RETRY_CONFIG.maxDelay
          );
          
          console.warn(`⚠️ Network error, retrying in ${delay}ms (attempt ${attemptNumber + 1}/${RETRY_CONFIG.maxRetries})...`);
          options.onMessage?.(`Connection issue, retrying (${attemptNumber + 1}/${RETRY_CONFIG.maxRetries})...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(attemptNumber + 1);
        }
        
        throw error;
      }
    };

    try {
      const response = await fetchWithRetry();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent-v2 API error: ${response.status} - ${errorText}`);
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
              case 'phase':
                setCurrentPhase(event.phase);
                console.log(`🔄 Phase: ${event.phase}`);
                options.onPhase?.(event.phase);
                
                // Emit thought complete when entering exploration
                if (event.phase === 'explore') {
                  const thinkDuration = Math.floor((Date.now() - thinkStart) / 1000);
                  options.onGenerationEvent?.({ 
                    type: 'thought', 
                    message: 'Request analyzed', 
                    duration: thinkDuration, 
                    status: 'completed' 
                  });
                }
                break;

              case 'exploration':
                console.log('🔍 Exploration:', event.data);
                options.onExploration?.(event.data);
                
                // Emit analyze and read events
                if (event.data?.relevantFiles) {
                  options.onGenerationEvent?.({ 
                    type: 'analyze', 
                    message: `${event.data.relevantFiles.length} file(s)`, 
                    status: 'completed' 
                  });
                  
                  event.data.relevantFiles.slice(0, 5).forEach((file: string) => {
                    options.onGenerationEvent?.({ 
                      type: 'read', 
                      message: file, 
                      file, 
                      status: 'completed' 
                    });
                  });
                }
                break;

              case 'message':
                options.onMessage?.(event.content);
                break;

              case 'code_update':
                const isNewFile = !projectFiles[event.path];
                const eventType = isNewFile ? 'create' : 'edit';
                
                if (!filesInProgressRef.current.has(event.path)) {
                  filesInProgressRef.current.add(event.path);
                  options.onGenerationEvent?.({ 
                    type: eventType, 
                    message: event.path, 
                    file: event.path,
                    status: 'in-progress'
                  });
                }
                
                options.onCodeUpdate?.(event.path, event.code);
                
                options.onGenerationEvent?.({ 
                  type: eventType, 
                  message: event.path, 
                  file: event.path,
                  status: 'completed'
                });
                
                filesInProgressRef.current.delete(event.path);
                break;

              case 'complete':
                console.log('🎉 Complete event received');
                clearTimeout(safetyTimeout);
                setIsStreaming(false);
                setIsLoading(false);
                setCurrentPhase('');
                options.onComplete?.();
                options.onGenerationEvent?.({ type: 'complete', message: 'Changes applied', status: 'completed' });
                break;

              case 'tokens':
                const tokens = {
                  input: event.input_tokens || 0,
                  output: event.output_tokens || 0,
                  total: event.total_tokens || 0
                };
                setTokenUsage(tokens);
                options.onTokens?.(tokens);
                console.log('📊 Tokens utilisés:', tokens);
                break;

              case 'error':
                throw new Error(event.message || 'Unknown error');
            }
          } catch (e) {
            console.error('Error parsing agent-v2 event:', e);
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
              console.log('🎉 Complete event received from buffer');
              clearTimeout(safetyTimeout);
              setIsStreaming(false);
              setIsLoading(false);
              setCurrentPhase('');
              options.onComplete?.();
              options.onGenerationEvent?.({ type: 'complete', message: 'Changes applied' });
            }
          } catch (e) {
            console.error('Error parsing final event:', e);
          }
        }
      }

      console.log('🔚 Stream ended naturally');
      clearTimeout(safetyTimeout);

    } catch (error: any) {
      clearTimeout(safetyTimeout);
      if (error.name !== 'AbortError') {
        console.error('Agent-v2 API error:', error);
        options.onError?.(error.message);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      setIsStreaming(false);
      setCurrentPhase('');
      abortControllerRef.current = null;
      filesInProgressRef.current.clear();
    }
  };

  const abort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
      setCurrentPhase('');
    }
  };

  return {
    callAgentV2,
    abort,
    isLoading,
    isStreaming,
    currentPhase,
    tokenUsage,
  };
}
