import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GenerationEvent } from '@/types/agent';
import { ASTModification } from '@/types/ast';

// ============= TYPES =============
interface Snapshot {
  files: Record<string, string>;
  timestamp: number;
}

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

interface AnalysisResult {
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  mode: 'chat' | 'quick' | 'full';
  confidence: number;
  relevantFiles: string[];
}

interface UnifiedAgentOptions {
  onStatus?: (status: string) => void;
  onMessage?: (message: string) => void;
  onAnalysis?: (analysis: AnalysisResult) => void;
  onCodeUpdate?: (path: string, code: string) => void;
  onASTModifications?: (modifications: ASTModification[]) => void;
  onGenerationEvent?: (event: GenerationEvent) => void;
  onTokens?: (tokens: TokenUsage) => void;
  onComplete?: (data: { mode: string; snapshot_timestamp: number }) => void;
  onError?: (error: string, snapshot?: Snapshot) => void;
  onFallbackRequired?: (reason: string) => void;
}

interface CallAgentParams {
  message: string;
  projectFiles: Record<string, string>;
  sessionId: string;
  projectType?: 'website' | 'webapp' | 'mobile';
  mode?: 'auto' | 'chat' | 'quick' | 'full';
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  chatHistory?: Array<{ role: string; content: string }>;
  memoryContext?: string;
}

// ============= HOOK =============
export function useUnifiedAgent() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMode, setCurrentMode] = useState<string>('');
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ input: 0, output: 0, total: 0 });
  const [lastSnapshot, setLastSnapshot] = useState<Snapshot | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const callAgent = useCallback(async (
    params: CallAgentParams,
    options: UnifiedAgentOptions = {}
  ) => {
    const {
      message,
      projectFiles,
      sessionId,
      projectType = 'website',
      mode = 'auto',
      attachedFiles = [],
      chatHistory = [],
      memoryContext
    } = params;

    setIsLoading(true);
    setIsStreaming(true);
    startTimeRef.current = Date.now();

    // Get auth session
    const { data: { session } } = await supabase.auth.getSession();
    
    // Create abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Emit initial thought event
    options.onGenerationEvent?.({
      type: 'thought',
      message: 'Analyzing request...',
      status: 'in-progress'
    });

    // Safety timeout - 240s for full, 60s for quick/chat
    const timeoutDuration = mode === 'full' ? 240000 : 60000;
    const safetyTimeout = setTimeout(() => {
      console.error(`⏱️ Timeout after ${timeoutDuration / 1000}s`);
      setIsStreaming(false);
      setIsLoading(false);
      options.onGenerationEvent?.({
        type: 'error',
        message: `Generation timeout (${timeoutDuration / 1000}s)`,
        status: 'error'
      });
      options.onError?.('Generation timed out');
    }, timeoutDuration);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-agent`,
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
            projectType,
            mode,
            attachedFiles,
            chatHistory,
            memoryContext
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Unified Agent error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);

            switch (event.type) {
              case 'status':
                options.onStatus?.(event.content);
                break;

              case 'analysis':
                setCurrentMode(event.data.mode);
                options.onAnalysis?.(event.data);
                
                // Update thought event with analysis result
                const thinkDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
                options.onGenerationEvent?.({
                  type: 'thought',
                  message: `Analysis complete (${event.data.complexity})`,
                  status: 'completed',
                  duration: thinkDuration
                });
                
                // Emit analyze event
                options.onGenerationEvent?.({
                  type: 'analyze',
                  message: `${event.data.relevantFiles.length} files identified`,
                  status: 'completed'
                });
                break;

              case 'message':
                options.onMessage?.(event.content);
                break;

              case 'code_update':
                options.onCodeUpdate?.(event.path, event.code);
                options.onGenerationEvent?.({
                  type: 'create',
                  message: event.path,
                  file: event.path,
                  status: 'completed'
                });
                break;

              case 'ast_modifications':
                options.onASTModifications?.(event.data.modifications);
                
                // Emit edit events for each modification
                event.data.modifications?.forEach((mod: ASTModification) => {
                  options.onGenerationEvent?.({
                    type: 'edit',
                    message: mod.path,
                    file: mod.path,
                    status: 'completed'
                  });
                });
                break;

              case 'tokens':
                const tokens: TokenUsage = {
                  input: event.input_tokens || 0,
                  output: event.output_tokens || 0,
                  total: event.total_tokens || 0
                };
                setTokenUsage(tokens);
                options.onTokens?.(tokens);
                break;

              case 'fallback_required':
                console.log('⚠️ Fallback required:', event.reason);
                options.onFallbackRequired?.(event.reason);
                break;

              case 'complete':
                clearTimeout(safetyTimeout);
                setIsStreaming(false);
                setIsLoading(false);
                setCurrentMode('');
                
                if (event.data?.snapshot_timestamp) {
                  setLastSnapshot({
                    files: projectFiles,
                    timestamp: event.data.snapshot_timestamp
                  });
                }
                
                options.onGenerationEvent?.({
                  type: 'complete',
                  message: 'Changes applied',
                  status: 'completed'
                });
                options.onComplete?.(event.data);
                break;

              case 'error':
                clearTimeout(safetyTimeout);
                setIsStreaming(false);
                setIsLoading(false);
                
                // Store snapshot for potential rollback
                if (event.snapshot) {
                  setLastSnapshot(event.snapshot);
                }
                
                options.onGenerationEvent?.({
                  type: 'error',
                  message: event.message,
                  status: 'error'
                });
                options.onError?.(event.message, event.snapshot);
                break;
            }
          } catch (e) {
            console.error('Error parsing unified-agent event:', e);
          }
        }
      }

      // Process remaining buffer
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
              options.onComplete?.(event.data);
            }
          } catch (e) {
            console.error('Error parsing final event:', e);
          }
        }
      }

      clearTimeout(safetyTimeout);

    } catch (error: any) {
      clearTimeout(safetyTimeout);
      if (error.name !== 'AbortError') {
        console.error('Unified Agent error:', error);
        options.onError?.(error.message);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      setIsStreaming(false);
      setCurrentMode('');
      abortControllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
      setCurrentMode('');
    }
  }, []);

  const rollback = useCallback((): Record<string, string> | null => {
    if (lastSnapshot) {
      console.log('🔄 Rolling back to snapshot:', lastSnapshot.timestamp);
      return lastSnapshot.files;
    }
    return null;
  }, [lastSnapshot]);

  return {
    callAgent,
    abort,
    rollback,
    isLoading,
    isStreaming,
    currentMode,
    tokenUsage,
    lastSnapshot,
  };
}
