/**
 * useVibeGenerate - Hook pour la génération de sites via VibeSDK
 * Remplace useGenerateSite avec une interface compatible
 */

import { useState, useRef, useCallback } from 'react';
import { vibeSDKService } from '@/services/vibesdk';
import type { GenerationEvent } from '@/types/agent';
import type { TokenUsage, SessionStatus } from '@/services/vibesdk';

// ============= Types =============

export interface GenerateParams {
  prompt: string;
  sessionId: string;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  projectType?: 'website' | 'webapp' | 'mobile';
}

export interface GenerateResult {
  success: boolean;
  files: Record<string, string>;
  tokens: TokenUsage;
  duration: number;
  previewUrl?: string;
}

export interface UseVibeGenerateOptions {
  onProgress?: (content: string) => void;
  onFiles?: (files: Record<string, string>) => void;
  onTokens?: (tokens: TokenUsage) => void;
  onError?: (error: string) => void;
  onComplete?: (result: GenerateResult) => void;
  onGenerationEvent?: (event: GenerationEvent) => void;
  onProjectName?: (name: string) => void;
  onPreviewReady?: (url: string) => void;
  onStatusChange?: (status: SessionStatus) => void;
}

// ============= Hook =============

export function useVibeGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [currentStatus, setCurrentStatus] = useState<SessionStatus | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const abortRef = useRef(false);

  // Annuler la génération
  const abort = useCallback(() => {
    abortRef.current = true;
    vibeSDKService.stopGeneration();
    setIsGenerating(false);
    setProgress('Cancelled');
  }, []);

  // Générer un site
  const generateSite = useCallback(async (
    params: GenerateParams,
    options: UseVibeGenerateOptions = {}
  ): Promise<GenerateResult | null> => {
    const { prompt, sessionId, attachedFiles, projectType } = params;
    const {
      onProgress,
      onFiles,
      onTokens,
      onError,
      onComplete,
      onGenerationEvent,
      onProjectName,
      onPreviewReady,
      onStatusChange,
    } = options;

    setIsGenerating(true);
    setProgress('Starting generation...');
    setCurrentStatus('initializing');
    abortRef.current = false;

    try {
      // Initialiser le service si nécessaire
      if (!vibeSDKService.isReady()) {
        vibeSDKService.initialize();
      }

      // Callbacks internes pour mettre à jour l'UI
      const internalCallbacks = {
        onProgress: (content: string) => {
          if (abortRef.current) return;
          onProgress?.(content);
        },
        onFiles: (files: Record<string, string>) => {
          if (abortRef.current) return;
          onFiles?.(files);
          setProgress('Files generated');
        },
        onTokens: (tokens: TokenUsage) => {
          if (abortRef.current) return;
          onTokens?.(tokens);
        },
        onError: (error: string) => {
          setIsGenerating(false);
          setProgress('Error: ' + error);
          onError?.(error);
        },
        onComplete: (result: any) => {
          if (abortRef.current) return;
          setIsGenerating(false);
          setProgress('Complete');
          onComplete?.(result);
        },
        onGenerationEvent: (event: GenerationEvent) => {
          if (abortRef.current) return;

          // Mettre à jour le progress basé sur l'événement
          switch (event.type) {
            case 'analyze':
              setProgress('Analyzing request...');
              setCurrentStatus('planning');
              break;
            case 'thought':
              setProgress('Generating code...');
              setCurrentStatus('coding');
              break;
            case 'create':
              setProgress(`Creating ${event.file || 'file'}...`);
              break;
            case 'complete':
              setProgress('Site ready!');
              setCurrentStatus('deployable');
              break;
          }

          onGenerationEvent?.(event);
          onStatusChange?.(currentStatus || 'initializing');
        },
        onProjectName: (name: string) => {
          if (abortRef.current) return;
          onProjectName?.(name);
        },
      };

      // Appeler le service VibeSDK
      const result = await vibeSDKService.generateSite(
        {
          prompt,
          sessionId,
          attachedFiles,
          projectType: projectType || 'website',
        },
        internalCallbacks
      );

      if (!result) {
        return null;
      }

      // Récupérer l'URL de preview
      const preview = vibeSDKService.getPreviewUrl();
      if (preview) {
        setPreviewUrl(preview);
        onPreviewReady?.(preview);
      }

      return {
        ...result,
        previewUrl: preview,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setIsGenerating(false);
      setProgress('Failed');
      onError?.(errorMessage);
      return null;
    }
  }, [currentStatus]);

  return {
    generateSite,
    abort,
    isGenerating,
    progress,
    currentStatus,
    previewUrl,
  };
}

export default useVibeGenerate;
