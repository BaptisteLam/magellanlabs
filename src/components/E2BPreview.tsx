import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface E2BPreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  className?: string;
}

export interface E2BPreviewHandle {
  reload: () => void;
  getPreviewUrl: () => string | null;
}

type SandboxState = 'idle' | 'creating' | 'ready' | 'updating' | 'error';

export const E2BPreview = forwardRef<E2BPreviewHandle, E2BPreviewProps>(({
  projectFiles,
  previewMode = 'desktop',
  className = '',
}, ref) => {
  const [sandboxState, setSandboxState] = useState<SandboxState>('idle');
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  
  const sandboxIdRef = useRef<string | null>(null);
  const filesHashRef = useRef<string>('');
  const createTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Hash simple des fichiers pour détecter les changements
  const getFilesHash = useCallback((files: Record<string, string>) => {
    const content = Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => `${path}:${content.length}`)
      .join('|');
    return content;
  }, []);

  // Créer une nouvelle sandbox
  const createSandbox = useCallback(async () => {
    if (Object.keys(projectFiles).length === 0) {
      console.log('[E2BPreview] No files to preview');
      return;
    }

    setSandboxState('creating');
    setError(null);

    try {
      console.log('[E2BPreview] Creating sandbox with', Object.keys(projectFiles).length, 'files');
      
      // Convertir en format array pour l'API
      const filesArray = Object.entries(projectFiles).map(([path, content]) => ({
        path,
        content
      }));

      const { data, error: invokeError } = await supabase.functions.invoke('preview-sandbox', {
        body: { files: filesArray }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create sandbox');
      }

      console.log('[E2BPreview] Sandbox created:', data.sandboxId);
      
      sandboxIdRef.current = data.sandboxId;
      setSandboxId(data.sandboxId);
      setPreviewUrl(data.previewUrl);
      setSandboxState('ready');
      filesHashRef.current = getFilesHash(projectFiles);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[E2BPreview] Create error:', errorMessage);
      setError(errorMessage);
      setSandboxState('error');
    }
  }, [projectFiles, getFilesHash]);

  // Mettre à jour les fichiers dans une sandbox existante
  const updateSandbox = useCallback(async () => {
    if (!sandboxIdRef.current || Object.keys(projectFiles).length === 0) {
      return;
    }

    setSandboxState('updating');

    try {
      console.log('[E2BPreview] Updating sandbox:', sandboxIdRef.current);
      
      const filesArray = Object.entries(projectFiles).map(([path, content]) => ({
        path,
        content
      }));

      const { data, error: invokeError } = await supabase.functions.invoke('update-sandbox', {
        body: { 
          sandboxId: sandboxIdRef.current,
          files: filesArray 
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data?.success) {
        // Si la sandbox n'existe plus, en créer une nouvelle
        console.log('[E2BPreview] Sandbox expired, creating new one');
        sandboxIdRef.current = null;
        setSandboxId(null);
        await createSandbox();
        return;
      }

      filesHashRef.current = getFilesHash(projectFiles);
      setSandboxState('ready');
      
      // Recharger l'iframe pour voir les changements
      setIframeKey(prev => prev + 1);

    } catch (err) {
      console.error('[E2BPreview] Update error:', err);
      // En cas d'erreur, recréer la sandbox
      sandboxIdRef.current = null;
      setSandboxId(null);
      await createSandbox();
    }
  }, [projectFiles, createSandbox, getFilesHash]);

  // Fermer la sandbox au démontage
  const closeSandbox = useCallback(async () => {
    if (sandboxIdRef.current) {
      console.log('[E2BPreview] Closing sandbox:', sandboxIdRef.current);
      try {
        await supabase.functions.invoke('close-sandbox', {
          body: { sandboxId: sandboxIdRef.current }
        });
      } catch (err) {
        console.error('[E2BPreview] Close error:', err);
      }
      sandboxIdRef.current = null;
    }
  }, []);

  // Recharger la preview
  const reload = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  // Exposer les méthodes via ref
  useImperativeHandle(ref, () => ({
    reload,
    getPreviewUrl: () => previewUrl
  }), [reload, previewUrl]);

  // Créer la sandbox au montage ou quand les fichiers changent significativement
  useEffect(() => {
    const currentHash = getFilesHash(projectFiles);
    
    // Pas de fichiers
    if (Object.keys(projectFiles).length === 0) {
      setSandboxState('idle');
      return;
    }

    // Première création
    if (!sandboxIdRef.current && sandboxState === 'idle') {
      // Debounce la création pour éviter les appels multiples
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
      }
      createTimeoutRef.current = setTimeout(() => {
        createSandbox();
      }, 500);
      return;
    }

    // Mise à jour si les fichiers ont changé
    if (sandboxIdRef.current && currentHash !== filesHashRef.current && sandboxState === 'ready') {
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }
      updateDebounceRef.current = setTimeout(() => {
        updateSandbox();
      }, 1000);
    }

    return () => {
      if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
      if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
    };
  }, [projectFiles, sandboxState, getFilesHash, createSandbox, updateSandbox]);

  // Nettoyer au démontage
  useEffect(() => {
    return () => {
      closeSandbox();
    };
  }, [closeSandbox]);

  // Dimensions selon le mode
  const containerStyle = previewMode === 'mobile' 
    ? { width: '375px', height: '100%', margin: '0 auto' }
    : { width: '100%', height: '100%' };

  // États de chargement et erreur
  if (sandboxState === 'idle' && Object.keys(projectFiles).length === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-muted/30 ${className}`}>
        <div className="text-center text-muted-foreground">
          <p className="text-lg">Aucun fichier à prévisualiser</p>
          <p className="text-sm mt-2">Générez un site pour voir la preview</p>
        </div>
      </div>
    );
  }

  if (sandboxState === 'creating') {
    return (
      <div className={`flex items-center justify-center h-full bg-muted/30 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: '#03A5C0' }} />
          <p className="text-lg font-medium">Création de l'environnement...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Préparation du serveur de preview E2B
          </p>
        </div>
      </div>
    );
  }

  if (sandboxState === 'error') {
    return (
      <div className={`flex items-center justify-center h-full bg-muted/30 ${className}`}>
        <div className="text-center max-w-md">
          <AlertCircle className="w-10 h-10 mx-auto mb-4 text-destructive" />
          <p className="text-lg font-medium text-destructive">Erreur de preview</p>
          <p className="text-sm text-muted-foreground mt-2 mb-4">{error}</p>
          <Button 
            onClick={createSandbox}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full ${className}`} style={containerStyle}>
      {/* Indicateur de mise à jour */}
      {sandboxState === 'updating' && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
          style={{
            backgroundColor: 'rgba(3, 165, 192, 0.15)',
            border: '1px solid #03A5C0',
            color: '#03A5C0',
          }}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Mise à jour...
        </div>
      )}

      {/* Barre d'actions */}
      {previewUrl && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={reload}
            className="h-8 px-2"
            title="Recharger"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(previewUrl, '_blank')}
            className="h-8 px-2"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* iframe de preview */}
      {previewUrl && (
        <iframe
          key={iframeKey}
          src={previewUrl}
          className="w-full h-full border-0 bg-white"
          title="E2B Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  );
});

E2BPreview.displayName = 'E2BPreview';

export default E2BPreview;
