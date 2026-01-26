/**
 * useVibeSDK - Hook principal pour l'intégration Cloudflare VibeSDK
 * Gère l'initialisation, l'état de la session, et expose le service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { vibeSDKService, VibeSDKService } from '@/services/vibesdk';
import type { VibeSession, SessionStatus, VibeCallbacks } from '@/services/vibesdk';

// ============= Types =============

export interface UseVibeSDKReturn {
  // État
  isInitialized: boolean;
  isConnected: boolean;
  session: VibeSession | null;
  status: SessionStatus | null;
  previewUrl: string | undefined;
  error: string | null;

  // Actions
  initialize: (apiKey?: string) => void;
  closeSession: () => void;

  // Service direct
  service: VibeSDKService;
}

// ============= Hook =============

export function useVibeSDK(apiKey?: string): UseVibeSDKReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState<VibeSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initRef = useRef(false);

  // Initialiser le service
  const initialize = useCallback((key?: string) => {
    if (initRef.current) return;

    try {
      vibeSDKService.initialize(key || apiKey);
      setIsInitialized(vibeSDKService.isReady());
      initRef.current = true;
      console.log('[useVibeSDK] Service initialized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    }
  }, [apiKey]);

  // Fermer la session
  const closeSession = useCallback(() => {
    vibeSDKService.closeSession();
    setSession(null);
    setIsConnected(false);
  }, []);

  // Auto-initialisation si une clé API est fournie
  useEffect(() => {
    if (apiKey && !initRef.current) {
      initialize(apiKey);
    }
  }, [apiKey, initialize]);

  // Polling de l'état de la session
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      const currentSession = vibeSDKService.getSessionState();
      if (currentSession) {
        setSession(currentSession);
        setIsConnected(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  return {
    isInitialized,
    isConnected,
    session,
    status: session?.status || null,
    previewUrl: vibeSDKService.getPreviewUrl(),
    error,
    initialize,
    closeSession,
    service: vibeSDKService,
  };
}

export default useVibeSDK;
