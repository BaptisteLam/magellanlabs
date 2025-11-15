import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AIEvent } from '@/types/agent';

interface UseAgentAPIOptions {
  onStatus?: (status: string) => void;
  onMessage?: (message: string) => void;
  onLog?: (log: string) => void;
  onIntent?: (intent: any) => void;
  onCodeUpdate?: (path: string, code: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onGenerationEvent?: (event: import('@/types/agent').GenerationEvent) => void;
}

export function useAgentAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const callAgent = async (
    message: string,
    projectFiles: Record<string, string>,
    relevantFiles: Array<{ path: string; content: string }>,
    chatHistory: Array<{ role: string; content: string }>,
    sessionId: string,
    options: UseAgentAPIOptions = {}
  ) => {
    setIsLoading(true);
    setIsStreaming(true);

    const { data: { session } } = await supabase.auth.getSession();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Track thinking time
    const thinkStart = Date.now();
    options.onGenerationEvent?.({ type: 'thought', message: 'Analyzing your request...', duration: 0 });

    // Emit read events for relevant files
    relevantFiles.slice(0, 5).forEach(file => {
      options.onGenerationEvent?.({ type: 'read', message: file.path });
    });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            projectFiles,
            relevantFiles,
            chatHistory,
            sessionId,
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
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
            const event: AIEvent = JSON.parse(dataStr);

            switch (event.type) {
              case 'status':
                options.onStatus?.(event.content);
                // Emit thought complete with duration after first status
                if (!options.onGenerationEvent) break;
                const thinkDuration = Math.floor((Date.now() - thinkStart) / 1000);
                options.onGenerationEvent({ type: 'thought', message: 'Request analyzed', duration: thinkDuration });
                break;
              case 'message':
                options.onMessage?.(event.content);
                break;
              case 'log':
                options.onLog?.(event.content);
                break;
              case 'intent':
                options.onIntent?.(event);
                break;
              case 'code_update':
                options.onCodeUpdate?.(event.path, event.code);
                options.onGenerationEvent?.({ type: 'edit', message: event.path, file: event.path });
                break;
              case 'complete':
                console.log('🎉 Complete event received');
                setIsStreaming(false);
                setIsLoading(false);
                options.onComplete?.();
                options.onGenerationEvent?.({ type: 'complete', message: 'Changes applied' });
                break;
            }
          } catch (e) {
            console.error('Error parsing event:', e);
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
            const event: AIEvent = JSON.parse(dataStr);
            if (event.type === 'complete') {
              console.log('🎉 Complete event received from buffer');
              setIsStreaming(false);
              setIsLoading(false);
              options.onComplete?.();
              options.onGenerationEvent?.({ type: 'complete', message: 'Changes applied' });
            }
          } catch (e) {
            console.error('Error parsing final event:', e);
          }
        }
      }

      // Force complete si le stream se termine sans événement complete
      console.log('🔚 Stream ended, forcing completion');
      setIsStreaming(false);
      setIsLoading(false);

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Agent API error:', error);
        options.onError?.(error.message);
      }
    } finally {
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
    callAgent,
    abort,
    isLoading,
    isStreaming,
  };
}
