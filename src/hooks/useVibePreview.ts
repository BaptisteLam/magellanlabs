/**
 * useVibePreview - Hook pour gérer les previews via VibeSDK Sandbox
 * Gère l'URL de preview, le hot reload, et les interactions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { vibeSDKService } from '@/services/vibesdk';
import type { SessionStatus } from '@/services/vibesdk';

// ============= Types =============

export interface PreviewState {
  url: string | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  mode: 'local' | 'sandbox' | 'deployed';
}

export interface UseVibePreviewOptions {
  sessionId: string;
  projectFiles: Record<string, string>;
  preferSandbox?: boolean;
  onReady?: (url: string) => void;
  onError?: (error: string) => void;
}

export interface UseVibePreviewReturn {
  // État
  previewState: PreviewState;
  previewUrl: string | null;
  isReady: boolean;

  // Actions
  refreshPreview: () => void;
  switchMode: (mode: 'local' | 'sandbox') => void;

  // HTML pour iframe (mode local)
  localHtml: string;
}

// ============= Helper Functions =============

/**
 * Génère le HTML complet pour la preview locale
 */
function generateLocalPreviewHtml(projectFiles: Record<string, string>): string {
  const htmlFile = projectFiles['index.html'] || '';
  const cssFile = projectFiles['styles.css'] || projectFiles['style.css'] || '';
  const jsFile = projectFiles['script.js'] || projectFiles['main.js'] || '';

  // Si on a un fichier HTML complet, l'utiliser directement
  if (htmlFile.includes('<html') || htmlFile.includes('<!DOCTYPE')) {
    // Injecter le CSS et JS si nécessaire
    let html = htmlFile;

    // Injecter CSS dans le head si pas déjà présent
    if (cssFile && !html.includes('<link') && !html.includes('<style>')) {
      html = html.replace('</head>', `<style>${cssFile}</style></head>`);
    }

    // Injecter JS avant </body> si pas déjà présent
    if (jsFile && !html.includes('<script')) {
      html = html.replace('</body>', `<script>${jsFile}</script></body>`);
    }

    return html;
  }

  // Sinon, construire un HTML complet
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    ${cssFile}
  </style>
</head>
<body>
  ${htmlFile}
  <script>
    ${jsFile}
  </script>
</body>
</html>`;
}

// ============= Hook =============

export function useVibePreview(options: UseVibePreviewOptions): UseVibePreviewReturn {
  const { sessionId, projectFiles, preferSandbox = false, onReady, onError } = options;

  const [previewState, setPreviewState] = useState<PreviewState>({
    url: null,
    isLoading: false,
    isReady: false,
    error: null,
    mode: preferSandbox ? 'sandbox' : 'local',
  });

  const [localHtml, setLocalHtml] = useState('');

  const isMountedRef = useRef(true);

  // Générer le HTML local quand les fichiers changent
  useEffect(() => {
    if (Object.keys(projectFiles).length > 0) {
      const html = generateLocalPreviewHtml(projectFiles);
      setLocalHtml(html);

      // Si en mode local, marquer comme prêt
      if (previewState.mode === 'local') {
        setPreviewState(prev => ({
          ...prev,
          isReady: true,
          isLoading: false,
        }));
      }
    }
  }, [projectFiles, previewState.mode]);

  // Vérifier l'URL sandbox VibeSDK
  useEffect(() => {
    if (!preferSandbox) return;

    const checkSandboxUrl = () => {
      const sandboxUrl = vibeSDKService.getPreviewUrl();

      if (sandboxUrl && isMountedRef.current) {
        setPreviewState(prev => ({
          ...prev,
          url: sandboxUrl,
          isReady: true,
          isLoading: false,
          mode: 'sandbox',
        }));
        onReady?.(sandboxUrl);
      }
    };

    // Vérifier immédiatement
    checkSandboxUrl();

    // Puis périodiquement
    const interval = setInterval(checkSandboxUrl, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [preferSandbox, onReady]);

  // Rafraîchir la preview
  const refreshPreview = useCallback(() => {
    setPreviewState(prev => ({ ...prev, isLoading: true }));

    if (previewState.mode === 'local') {
      // Regénérer le HTML
      const html = generateLocalPreviewHtml(projectFiles);
      setLocalHtml(html);

      setPreviewState(prev => ({
        ...prev,
        isLoading: false,
        isReady: true,
      }));
    } else {
      // Pour sandbox, forcer un rechargement
      const currentUrl = vibeSDKService.getPreviewUrl();
      if (currentUrl) {
        setPreviewState(prev => ({
          ...prev,
          url: currentUrl + '?t=' + Date.now(), // Cache busting
          isLoading: false,
          isReady: true,
        }));
      }
    }
  }, [previewState.mode, projectFiles]);

  // Changer de mode
  const switchMode = useCallback((mode: 'local' | 'sandbox') => {
    setPreviewState(prev => ({
      ...prev,
      mode,
      isLoading: mode === 'sandbox',
      isReady: mode === 'local',
      url: mode === 'local' ? null : prev.url,
    }));

    if (mode === 'local') {
      const html = generateLocalPreviewHtml(projectFiles);
      setLocalHtml(html);
    }
  }, [projectFiles]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    previewState,
    previewUrl: previewState.mode === 'sandbox' ? previewState.url : null,
    isReady: previewState.isReady,
    refreshPreview,
    switchMode,
    localHtml,
  };
}

export default useVibePreview;
