import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { createSandbox, getEmbedUrl } from '@/services/codesandboxService';
import { useThemeStore } from '@/stores/themeStore';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface CodeSandboxPreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  onIframeReady?: (iframe: HTMLIFrameElement) => void;
  onError?: (error: string) => void;
}

export interface CodeSandboxPreviewHandle {
  reload: () => void;
  getIframe: () => HTMLIFrameElement | null;
}

export const CodeSandboxPreview = forwardRef<CodeSandboxPreviewHandle, CodeSandboxPreviewProps>(({
  projectFiles,
  previewMode = 'desktop',
  onIframeReady,
  onError
}, ref) => {
  const { isDark } = useThemeStore();
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastFilesHashRef = useRef<string>('');

  // Hash des fichiers pour détecter les changements
  const filesHash = useMemo(() => {
    return JSON.stringify(Object.keys(projectFiles).sort());
  }, [projectFiles]);

  // Créer le sandbox quand les fichiers changent
  useEffect(() => {
    // Éviter les appels redondants si les fichiers n'ont pas changé
    if (filesHash === lastFilesHashRef.current && embedUrl) {
      return;
    }
    lastFilesHashRef.current = filesHash;

    const createAndEmbed = async () => {
      // Ne pas créer de sandbox si pas de fichiers
      if (Object.keys(projectFiles).length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        console.log('[CodeSandboxPreview] Creating sandbox...');
        const sandboxId = await createSandbox(projectFiles);
        const url = getEmbedUrl(sandboxId, {
          theme: isDark ? 'dark' : 'light',
          view: 'preview',
          hideNavigation: true,
          hideDevTools: true
        });
        
        console.log('[CodeSandboxPreview] Embed URL:', url);
        setEmbedUrl(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        console.error('[CodeSandboxPreview] Error:', message);
        setError(message);
        onError?.(message);
      } finally {
        setIsLoading(false);
      }
    };

    createAndEmbed();
  }, [projectFiles, filesHash, isDark, onError, embedUrl]);

  // Recharger quand le thème change
  useEffect(() => {
    if (embedUrl) {
      const sandboxId = embedUrl.split('/embed/')[1]?.split('?')[0];
      if (sandboxId) {
        const newUrl = getEmbedUrl(sandboxId, {
          theme: isDark ? 'dark' : 'light',
          view: 'preview',
          hideNavigation: true,
          hideDevTools: true
        });
        setEmbedUrl(newUrl);
      }
    }
  }, [isDark]);

  // Notifier quand l'iframe est prête
  const handleIframeLoad = () => {
    if (iframeRef.current) {
      onIframeReady?.(iframeRef.current);
    }
  };

  // Méthode pour recharger
  const reload = () => {
    if (iframeRef.current && embedUrl) {
      iframeRef.current.src = embedUrl;
    }
  };

  useImperativeHandle(ref, () => ({
    reload,
    getIframe: () => iframeRef.current
  }));

  // État de chargement
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#03A5C0]" />
          <p className="text-sm text-muted-foreground">Chargement de la preview...</p>
        </div>
      </div>
    );
  }

  // État d'erreur
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Erreur de preview</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={() => {
              lastFilesHashRef.current = '';
              setError(null);
              setIsLoading(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
              border: '1px solid'
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Pas de fichiers
  if (!embedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Aucun fichier à prévisualiser</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto border-x border-border' : ''}`}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="Preview"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone"
        onLoad={handleIframeLoad}
      />
    </div>
  );
});

CodeSandboxPreview.displayName = 'CodeSandboxPreview';

export default CodeSandboxPreview;
