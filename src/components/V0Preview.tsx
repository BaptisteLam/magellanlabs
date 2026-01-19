import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface V0PreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  className?: string;
  v0ChatId?: string;
  v0DemoUrl?: string;
}

export interface V0PreviewHandle {
  reload: () => void;
  getPreviewUrl: () => string | null;
  getIframe: () => HTMLIFrameElement | null;
}

export const V0Preview = forwardRef<V0PreviewHandle, V0PreviewProps>(({
  projectFiles,
  previewMode = 'desktop',
  className,
  v0ChatId,
  v0DemoUrl,
}, ref) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    reload: () => {
      if (iframeRef.current && previewUrl) {
        iframeRef.current.src = previewUrl;
      }
    },
    getPreviewUrl: () => previewUrl,
    getIframe: () => iframeRef.current,
  }));

  // Generate preview from project files
  useEffect(() => {
    if (v0DemoUrl) {
      // Use V0's demo URL if available
      setPreviewUrl(v0DemoUrl);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Generate local blob URL preview
    generateLocalPreview();
  }, [projectFiles, v0DemoUrl]);

  const generateLocalPreview = () => {
    setIsLoading(true);
    setError(null);

    try {
      // Revoke previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // Find HTML file
      let htmlContent = projectFiles['index.html'] || 
                        Object.entries(projectFiles).find(([k]) => k.endsWith('.html'))?.[1];

      if (!htmlContent) {
        // Generate minimal HTML if none exists
        htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;">
    <p style="color:#666;">Aucun fichier HTML trouvé</p>
  </div>
</body>
</html>`;
      }

      // Inject CSS if not already linked
      const cssContent = projectFiles['styles.css'] || projectFiles['style.css'];
      if (cssContent && !htmlContent.includes('styles.css') && !htmlContent.includes('style.css')) {
        htmlContent = htmlContent.replace(
          '</head>',
          `<style>\n${cssContent}\n</style>\n</head>`
        );
      }

      // Inject JS if not already linked
      const jsContent = projectFiles['app.js'] || projectFiles['script.js'] || projectFiles['main.js'];
      if (jsContent && !htmlContent.includes('app.js') && !htmlContent.includes('script.js')) {
        htmlContent = htmlContent.replace(
          '</body>',
          `<script>\n${jsContent}\n</script>\n</body>`
        );
      }

      // Add base styling for better rendering
      if (!htmlContent.includes('<base')) {
        htmlContent = htmlContent.replace(
          '<head>',
          `<head>\n<base href=".">\n<style>* { box-sizing: border-box; }</style>`
        );
      }

      // Create blob URL
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPreviewUrl(url);
      setIsLoading(false);
    } catch (err) {
      console.error('[V0Preview] Error generating preview:', err);
      setError('Erreur lors de la génération de la preview');
      setIsLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handleReload = () => {
    if (v0DemoUrl) {
      if (iframeRef.current) {
        iframeRef.current.src = v0DemoUrl;
      }
    } else {
      generateLocalPreview();
    }
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full bg-background",
        className
      )}>
        <Loader2 className="w-8 h-8 animate-spin text-[#03A5C0] mb-4" />
        <p className="text-muted-foreground text-sm">Chargement de la preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full bg-background",
        className
      )}>
        <p className="text-destructive mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={handleReload}
          className="border-[#03A5C0] text-[#03A5C0] hover:bg-[#03A5C0]/10"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-col h-full bg-background", className)}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReload}
          className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-background"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        {previewUrl && !previewUrl.startsWith('blob:') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenExternal}
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-background"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Preview iframe container */}
      <div className={cn(
        "flex-1 flex items-center justify-center p-4 bg-muted/30",
        previewMode === 'mobile' && "p-8"
      )}>
        <div className={cn(
          "relative bg-white rounded-lg shadow-lg overflow-hidden",
          previewMode === 'desktop' ? "w-full h-full" : "w-[375px] h-[667px] border-[8px] border-slate-800 rounded-[32px]"
        )}>
          {previewUrl && (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full border-0"
              title="V0 Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => setIsLoading(false)}
            />
          )}
        </div>
      </div>

      {/* V0 attribution badge */}
      {v0ChatId && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 text-white text-xs rounded flex items-center gap-1">
          <span>Powered by</span>
          <span className="font-semibold">V0</span>
        </div>
      )}
    </div>
  );
});

V0Preview.displayName = 'V0Preview';
