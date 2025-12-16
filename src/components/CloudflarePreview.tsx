import { useRef, useEffect, useState, useCallback } from 'react';
import { type ElementInfo } from './InspectOverlay';
import { Loader2 } from 'lucide-react';

interface CloudflarePreviewProps {
  previewUrl: string;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
  isSyncing?: boolean;
}

export function CloudflarePreview({
  previewUrl,
  isDark = false,
  inspectMode = false,
  onElementSelect,
  isSyncing = false,
}: CloudflarePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

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

  // Forcer le rechargement quand isSyncing passe de true à false
  const prevSyncingRef = useRef(isSyncing);
  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && iframeRef.current) {
      console.log('🔄 Reloading iframe after sync');
      setIsLoading(true);
      setIframeReady(false);
      // Ajouter un timestamp pour forcer le rechargement
      const currentSrc = iframeRef.current.src;
      const urlObj = new URL(currentSrc);
      urlObj.searchParams.set('_t', Date.now().toString());
      iframeRef.current.src = urlObj.toString();
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Ajouter le paramètre inspect à l'URL si le mode est actif
  const getIframeUrl = () => {
    const url = new URL(previewUrl);
    url.searchParams.set('_t', Date.now().toString());
    return url.toString();
  };

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {(isLoading || isSyncing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <span className="text-sm text-muted-foreground">
              {isSyncing ? 'Synchronisation...' : 'Chargement...'}
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
