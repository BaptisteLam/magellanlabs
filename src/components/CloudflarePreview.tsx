import { useRef, useEffect, useState, useCallback } from 'react';
import { type ElementInfo } from './InspectOverlay';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface CloudflarePreviewProps {
  previewUrl: string;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
  isSyncing?: boolean;
  syncError?: string | null;
  onRetrySync?: () => void;
}

export function CloudflarePreview({
  previewUrl,
  isDark = false,
  inspectMode = false,
  onElementSelect,
  isSyncing = false,
  syncError = null,
  onRetrySync,
}: CloudflarePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Vérifier que le message vient de notre preview
      if (!event.origin.includes('builtbymagellan.com')) {
        return;
      }

      if (event.data.type === 'inspect-ready') {
        console.log('📡 Cloudflare iframe inspector ready');
        setIframeReady(true);
        setIframeError(false);
      }

      if (event.data.type === 'element-selected' && onElementSelect) {
        console.log('✅ Element selected from Cloudflare:', event.data.data);
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Envoyer le mode inspect à l'iframe quand il change
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;

    console.log('🔄 Sending toggle-inspect to Cloudflare iframe:', inspectMode);
    iframeRef.current.contentWindow.postMessage(
      { type: 'toggle-inspect', enabled: inspectMode },
      '*'
    );
  }, [inspectMode, iframeReady]);

  // Recharger l'iframe quand le sync est terminé
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    console.log('✅ Cloudflare iframe loaded');
  }, []);

  // Détecter les erreurs de chargement de l'iframe
  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setIframeError(true);
    console.error('❌ Cloudflare iframe failed to load');
  }, []);

  // Forcer le rechargement quand isSyncing passe de true à false
  const prevSyncingRef = useRef(isSyncing);
  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && iframeRef.current && !syncError) {
      console.log('🔄 Reloading iframe after sync');
      setIsLoading(true);
      setIframeReady(false);
      setIframeError(false);
      // Ajouter un timestamp pour forcer le rechargement
      const currentSrc = iframeRef.current.src;
      const urlObj = new URL(currentSrc);
      urlObj.searchParams.set('_t', Date.now().toString());
      iframeRef.current.src = urlObj.toString();
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, syncError]);

  // Ajouter le paramètre inspect à l'URL si le mode est actif
  const getIframeUrl = () => {
    const url = new URL(previewUrl);
    url.searchParams.set('_t', Date.now().toString());
    return url.toString();
  };

  // Afficher une erreur si le sync a échoué
  if (syncError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Erreur de déploiement
          </h3>
          <p className="text-sm text-muted-foreground">
            Le déploiement sur Cloudflare a échoué. Vérifiez que le token API Cloudflare est correctement configuré.
          </p>
          <p className="text-xs text-muted-foreground/70 font-mono bg-muted p-2 rounded">
            {syncError}
          </p>
          {onRetrySync && (
            <Button
              onClick={onRetrySync}
              className="gap-2"
              style={{ 
                borderColor: 'rgb(3,165,192)', 
                backgroundColor: 'rgba(3,165,192,0.1)', 
                color: 'rgb(3,165,192)' 
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {(isLoading || isSyncing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <span className="text-sm text-muted-foreground">
              {isSyncing ? 'Déploiement en cours...' : 'Chargement de la preview...'}
            </span>
          </div>
        </div>
      )}

      {/* Iframe Cloudflare */}
      <iframe
        ref={iframeRef}
        src={getIframeUrl()}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Preview"
      />

      {/* Indicateur mode inspect */}
      {inspectMode && (
        <div className="absolute top-4 right-4 z-20 bg-accent/90 text-accent-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
          Mode inspection actif
        </div>
      )}
    </div>
  );
}
