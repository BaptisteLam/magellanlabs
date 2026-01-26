/**
 * useVibeModify - Hook pour les modifications de sites via VibeSDK
 * Remplace useUnifiedModify avec une interface compatible
 */

import { useState, useRef, useCallback } from 'react';
import { vibeSDKService } from '@/services/vibesdk';
import type { TokenUsage, SessionStatus } from '@/services/vibesdk';

// ============= Types =============

export interface ModifyParams {
  message: string;
  projectFiles: Record<string, string>;
  sessionId: string;
  memory?: any;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface ASTModification {
  type: 'css-change' | 'html-change' | 'jsx-change' | 'file-create' | 'file-modify' | 'file-delete';
  path: string;
  target?: string;
  property?: string;
  attribute?: string;
  value?: string;
  changes?: Record<string, string>;
  changeType?: 'modified' | 'created' | 'deleted';
}

export interface ModifyResult {
  success: boolean;
  modifications: ASTModification[];
  updatedFiles: Record<string, string>;
  message: string;
  intentMessage?: string;
  filesAffected?: Array<{ path: string; description: string; changeType: string }>;
  tokens: TokenUsage;
  duration: number;
  analysis: {
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    intentType: 'quick-modification' | 'full-generation';
    confidence: number;
    explanation: string;
  };
}

// Backend SSE event format
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

export interface UseVibeModifyOptions {
  onIntentMessage?: (message: string) => void;
  onGenerationEvent?: (event: SSEGenerationEvent) => void;
  onFileModified?: (file: string, description: string) => void;
  onASTModifications?: (modifications: ASTModification[], updatedFiles: Record<string, string>) => Promise<void>;
  onTokens?: (tokens: TokenUsage) => void;
  onError?: (error: string) => void;
  onComplete?: (result: ModifyResult) => void;
  onStatusChange?: (status: SessionStatus) => void;
}

// ============= Hook =============

export function useVibeModify() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);

  const abortRef = useRef(false);

  // Annuler la modification
  const abort = useCallback(() => {
    abortRef.current = true;
    vibeSDKService.stopGeneration();
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  // Modifier un site
  const unifiedModify = useCallback(async (
    params: ModifyParams,
    options: UseVibeModifyOptions = {}
  ): Promise<ModifyResult | null> => {
    const { message, projectFiles, sessionId, memory, conversationHistory } = params;
    const {
      onIntentMessage,
      onGenerationEvent,
      onFileModified,
      onASTModifications,
      onTokens,
      onError,
      onComplete,
      onStatusChange,
    } = options;

    setIsLoading(true);
    setIsStreaming(true);
    setCurrentPhase('analyze');
    abortRef.current = false;

    try {
      // Initialiser le service si nécessaire
      if (!vibeSDKService.isReady()) {
        vibeSDKService.initialize();
      }

      // Callbacks internes
      const internalCallbacks = {
        onIntentMessage: (msg: string) => {
          if (abortRef.current) return;
          onIntentMessage?.(msg);
        },
        onGenerationEvent: (event: SSEGenerationEvent) => {
          if (abortRef.current) return;

          // Mettre à jour la phase actuelle
          if (event.phase) {
            setCurrentPhase(event.phase);
          }

          // Émettre les événements de statut
          if (event.type === 'phase') {
            switch (event.phase) {
              case 'analyze':
                onStatusChange?.('planning');
                break;
              case 'generation':
                onStatusChange?.('coding');
                break;
              case 'validation':
                onStatusChange?.('debugging');
                break;
            }
          }

          onGenerationEvent?.(event);
        },
        onFileModified: (file: string, description: string) => {
          if (abortRef.current) return;
          onFileModified?.(file, description);
        },
        onASTModifications: async (modifications: ASTModification[], updatedFiles: Record<string, string>) => {
          if (abortRef.current) return;
          await onASTModifications?.(modifications, updatedFiles);
        },
        onTokens: (tokens: TokenUsage) => {
          if (abortRef.current) return;
          onTokens?.(tokens);
        },
        onError: (error: string) => {
          setIsLoading(false);
          setIsStreaming(false);
          onError?.(error);
        },
        onComplete: (result: ModifyResult) => {
          if (abortRef.current) return;
          setIsLoading(false);
          setIsStreaming(false);
          setCurrentPhase(null);
          onComplete?.(result);
        },
      };

      // Appeler le service VibeSDK
      const result = await vibeSDKService.modifySite(
        {
          message,
          projectFiles,
          sessionId,
          memory,
          conversationHistory,
        },
        internalCallbacks
      );

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setIsLoading(false);
      setIsStreaming(false);
      onError?.(errorMessage);
      return null;
    }
  }, []);

  return {
    unifiedModify,
    abort,
    isLoading,
    isStreaming,
    currentPhase,
  };
}

export default useVibeModify;
