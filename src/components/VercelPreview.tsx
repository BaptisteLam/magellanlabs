/**
 * VercelPreview - Composant de preview via Vercel
 * Affiche l'iframe pointant vers le déploiement Vercel
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, RefreshCw, CheckCircle, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VercelPreviewProps {
  previewUrl: string;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (element: any) => void;
  isSyncing?: boolean;
  syncError?: string | null;
  onRetrySync?: () => void;
  deploymentStatus?: string;
}

export function VercelPreview({
  previewUrl,
  isDark = true,
  inspectMode = false,
  onElementSelect,
  isSyncing = false,
  syncError = null,
  onRetrySync,
  deploymentStatus = 'READY',
}: VercelPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [lastSyncedUrl, setLastSyncedUrl] = useState<string | null>(null);

  // Reload iframe when URL changes after sync
  useEffect(() => {
    if (previewUrl && previewUrl !== lastSyncedUrl && !isSyncing) {
      setLastSyncedUrl(previewUrl);
      setIsLoading(true);
      setIframeError(false);

      // Force reload by resetting src
      if (iframeRef.current) {
        const currentSrc = iframeRef.current.src;
        iframeRef.current.src = '';
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = previewUrl;
          }
        }, 100);
      }
    }
  }, [previewUrl, isSyncing, lastSyncedUrl]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setIframeError(true);
  };

  const handleRefresh = () => {
    if (iframeRef.current && previewUrl) {
      setIsLoading(true);
      setIframeError(false);
      iframeRef.current.src = previewUrl;
    }
  };

  // Show sync error state
  if (syncError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface/50 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-4 text-red-400" />
        <p className="text-lg font-medium mb-2">Erreur de synchronisation</p>
        <p className="text-sm text-center max-w-md mb-4 opacity-70">{syncError}</p>
        {onRetrySync && (
          <Button onClick={onRetrySync} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  // Show deploying state
  if (isSyncing || deploymentStatus === 'BUILDING') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface/50 text-gray-400">
        <CloudUpload className="w-12 h-12 mb-4 text-cyan-400 animate-pulse" />
        <p className="text-lg font-medium mb-2">Déploiement en cours...</p>
        <p className="text-sm opacity-70">Synchronisation vers Vercel</p>
        <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 animate-pulse rounded-full" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  // No URL yet
  if (!previewUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface/50 text-gray-400">
        <Loader2 className="w-12 h-12 mb-4 animate-spin text-cyan-400" />
        <p className="text-lg font-medium">En attente du déploiement...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/80 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm text-gray-400">Chargement de la preview...</p>
        </div>
      )}

      {/* Error overlay */}
      {iframeError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/80 backdrop-blur-sm">
          <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-sm text-gray-400 mb-3">Erreur de chargement</p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
      )}

      {/* Sync success indicator */}
      {!isSyncing && !isLoading && !iframeError && deploymentStatus === 'READY' && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs">
          <CheckCircle className="w-3 h-3" />
          <span>Synchronisé</span>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={previewUrl}
        className={cn(
          'w-full h-full border-0 transition-opacity duration-300',
          (isLoading || iframeError) && 'opacity-0'
        )}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="Preview"
      />

      {/* Inspect mode indicator */}
      {inspectMode && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Mode inspection actif
        </div>
      )}
    </div>
  );
}
