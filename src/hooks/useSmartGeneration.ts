/**
 * useSmartGeneration - Hook intelligent qui route vers VibeSDK ou le système legacy
 * Permet une migration progressive sans casser l'existant
 */

import { useState, useCallback, useRef } from 'react';
import { useGenerateSite, type GenerationEvent, type UseGenerateSiteOptions } from './useGenerateSite';
import { useUnifiedModify, type UseUnifiedModifyOptions } from './useUnifiedModify';
import { useVibeGenerate, type UseVibeGenerateOptions } from './useVibeGenerate';
import { useVibeModify, type UseVibeModifyOptions } from './useVibeModify';
import { vibeSDKService } from '@/services/vibesdk';

// ============= Configuration =============

// Activer VibeSDK via variable d'environnement
const USE_VIBESDK = import.meta.env.VITE_USE_VIBESDK === 'true';
const VIBESDK_API_KEY = import.meta.env.VITE_VIBESDK_API_KEY || '';

// ============= Types =============

export interface SmartGenerateParams {
  prompt: string;
  sessionId: string;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  projectType?: 'website' | 'webapp' | 'mobile';
}

export interface SmartModifyParams {
  message: string;
  projectFiles: Record<string, string>;
  sessionId: string;
  memory?: any;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface SmartGenerationResult {
  success: boolean;
  files: Record<string, string>;
  tokens: { input: number; output: number; total: number };
  duration: number;
  previewUrl?: string;
  provider: 'vibesdk' | 'legacy';
}

export interface SmartModifyResult {
  success: boolean;
  modifications: any[];
  updatedFiles: Record<string, string>;
  message: string;
  tokens: { input: number; output: number; total: number };
  duration: number;
  provider: 'vibesdk' | 'legacy';
}

// ============= Hook =============

export function useSmartGeneration() {
  // État
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [provider, setProvider] = useState<'vibesdk' | 'legacy'>(USE_VIBESDK && VIBESDK_API_KEY ? 'vibesdk' : 'legacy');
  const [progress, setProgress] = useState('');

  // Hooks legacy
  const legacyGenerate = useGenerateSite();
  const legacyModify = useUnifiedModify();

  // Hooks VibeSDK
  const vibeGenerate = useVibeGenerate();
  const vibeModify = useVibeModify();

  const abortRef = useRef(false);

  // Initialiser VibeSDK si nécessaire
  const initVibeSDK = useCallback(() => {
    if (USE_VIBESDK && VIBESDK_API_KEY && !vibeSDKService.isReady()) {
      vibeSDKService.initialize(VIBESDK_API_KEY);
      console.log('[SmartGeneration] VibeSDK initialized');
    }
  }, []);

  // Changer de provider
  const switchProvider = useCallback((newProvider: 'vibesdk' | 'legacy') => {
    if (newProvider === 'vibesdk' && !VIBESDK_API_KEY) {
      console.warn('[SmartGeneration] Cannot switch to VibeSDK: no API key');
      return;
    }

    setProvider(newProvider);
    console.log('[SmartGeneration] Switched to provider:', newProvider);
  }, []);

  // Génération intelligente
  const generateSite = useCallback(async (
    params: SmartGenerateParams,
    options: UseGenerateSiteOptions & UseVibeGenerateOptions = {}
  ): Promise<SmartGenerationResult | null> => {
    setIsGenerating(true);
    abortRef.current = false;

    const currentProvider = provider;
    console.log('[SmartGeneration] Generating site with provider:', currentProvider);

    try {
      if (currentProvider === 'vibesdk' && vibeSDKService.isReady()) {
        // Utiliser VibeSDK
        initVibeSDK();

        const result = await vibeGenerate.generateSite(params, {
          ...options,
          onProgress: (content) => {
            setProgress(content.substring(0, 50) + '...');
            options.onProgress?.(content);
          },
        });

        if (!result) return null;

        return {
          ...result,
          provider: 'vibesdk',
        };
      } else {
        // Fallback sur le système legacy
        const result = await legacyGenerate.generateSite(params, {
          ...options,
          onProgress: (content) => {
            setProgress(content.substring(0, 50) + '...');
            options.onProgress?.(content);
          },
        });

        if (!result) return null;

        return {
          ...result,
          provider: 'legacy',
        };
      }
    } finally {
      setIsGenerating(false);
    }
  }, [provider, initVibeSDK, vibeGenerate, legacyGenerate]);

  // Modification intelligente
  const modifySite = useCallback(async (
    params: SmartModifyParams,
    options: UseUnifiedModifyOptions & UseVibeModifyOptions = {}
  ): Promise<SmartModifyResult | null> => {
    setIsModifying(true);
    abortRef.current = false;

    const currentProvider = provider;
    console.log('[SmartGeneration] Modifying site with provider:', currentProvider);

    try {
      if (currentProvider === 'vibesdk' && vibeSDKService.isReady()) {
        // Utiliser VibeSDK
        initVibeSDK();

        const result = await vibeModify.unifiedModify(params, options);

        if (!result) return null;

        return {
          success: result.success,
          modifications: result.modifications,
          updatedFiles: result.updatedFiles,
          message: result.message,
          tokens: result.tokens,
          duration: result.duration,
          provider: 'vibesdk',
        };
      } else {
        // Fallback sur le système legacy
        const result = await legacyModify.unifiedModify(params, options);

        if (!result) return null;

        return {
          success: result.success,
          modifications: result.modifications,
          updatedFiles: result.updatedFiles,
          message: result.message,
          tokens: result.tokens,
          duration: result.duration,
          provider: 'legacy',
        };
      }
    } finally {
      setIsModifying(false);
    }
  }, [provider, initVibeSDK, vibeModify, legacyModify]);

  // Annuler l'opération en cours
  const abort = useCallback(() => {
    abortRef.current = true;

    if (provider === 'vibesdk') {
      vibeGenerate.abort();
      vibeModify.abort();
    } else {
      legacyGenerate.abort();
      legacyModify.abort();
    }
  }, [provider, vibeGenerate, vibeModify, legacyGenerate, legacyModify]);

  return {
    // État
    isGenerating,
    isModifying,
    isLoading: isGenerating || isModifying,
    provider,
    progress,

    // Actions
    generateSite,
    modifySite,
    abort,
    switchProvider,

    // Accès direct aux hooks sous-jacents (pour cas avancés)
    vibeGenerate,
    vibeModify,
    legacyGenerate,
    legacyModify,

    // Utilitaires
    isVibeSDKEnabled: USE_VIBESDK && !!VIBESDK_API_KEY,
    previewUrl: vibeSDKService.getPreviewUrl(),
  };
}

export default useSmartGeneration;
