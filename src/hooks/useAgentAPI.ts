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
  onTokens?: (tokens: { input: number; output: number; total: number }) => void;
}

export function useAgentAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const filesInProgressRef = useRef<Set<string>>(new Set());

  const callAgent = async (
    message: string,
    projectFiles: Record<string, string>,
    relevantFiles: Array<{ path: string; content: string }>,
    chatHistory: Array<{ role: string; content: string }>,
    sessionId: string,
    projectType: string = 'webapp',
    attachedFiles: Array<{ name: string; base64: string; type: string }> = [],
    options: UseAgentAPIOptions = {}
  ) => {
    setIsLoading(true);
    setIsStreaming(true);

    const { data: { session } } = await supabase.auth.getSession();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Track thinking time and emit initial planning event
    const thinkStart = Date.now();
    options.onGenerationEvent?.({ type: 'thought', message: 'Analyzing your request...', status: 'in-progress' });

    // Emit analyze event for relevant files
    if (relevantFiles.length > 0) {
      options.onGenerationEvent?.({ type: 'analyze', message: `${relevantFiles.length} file(s)`, status: 'in-progress' });
    }

    // Emit read events for relevant files
    relevantFiles.slice(0, 5).forEach(file => {
      options.onGenerationEvent?.({ type: 'read', message: file.path, file: file.path, status: 'completed' });
    });

    // Timeout de sécurité : force l'arrêt après 120s même sans complete
    const safetyTimeout = setTimeout(() => {
      console.warn('⏱️ Timeout: Arrêt forcé après 120s sans événement complete');
      setIsStreaming(false);
      setIsLoading(false);
      options.onComplete?.();
      options.onGenerationEvent?.({ type: 'complete', message: 'Generation completed (timeout)' });
    }, 120000);

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
            projectType,
            attachedFiles,
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
                options.onGenerationEvent({ type: 'thought', message: 'Request analyzed', duration: thinkDuration, status: 'completed' });
                
                // Detect planning phase from status messages
                if (event.content.toLowerCase().includes('plan')) {
                  options.onGenerationEvent({ type: 'plan', message: event.content.replace(/^(Task:|Titre:)\s*/i, ''), status: 'in-progress' });
                }
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
                // Emit in-progress event if this is the first update for this file
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
                
                // Apply the code update
                options.onCodeUpdate?.(event.path, event.code);
                
                // Emit completed event after code is applied
                options.onGenerationEvent?.({ 
                  type: eventType, 
                  message: event.path, 
                  file: event.path,
                  status: 'completed'
                });
                
                // Remove from in-progress tracking
                filesInProgressRef.current.delete(event.path);
                break;
              case 'complete':
                console.log('🎉 Complete event received');
                clearTimeout(safetyTimeout);
                setIsStreaming(false);
                setIsLoading(false);
                options.onComplete?.();
                options.onGenerationEvent?.({ type: 'complete', message: 'Changes applied', status: 'completed' });
                break;
              case 'tokens':
                // Capturer les tokens d'utilisation
                const tokens = {
                  input: (event as any).input_tokens || 0,
                  output: (event as any).output_tokens || 0,
                  total: (event as any).total_tokens || 0
                };
                setTokenUsage(tokens);
                options.onTokens?.(tokens);
                console.log('📊 Tokens utilisés:', tokens);
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
              clearTimeout(safetyTimeout);
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

      // NE PAS forcer la complétion ici - attendre l'événement 'complete' explicite
      // ou le timeout de sécurité
      console.log('🔚 Stream ended naturally');
      clearTimeout(safetyTimeout);

    } catch (error: any) {
      clearTimeout(safetyTimeout);
      if (error.name !== 'AbortError') {
        console.error('Agent API error:', error);
        options.onError?.(error.message);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
      filesInProgressRef.current.clear();
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
    tokenUsage,
  };
}
