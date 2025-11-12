import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { GeneratingPreview } from './GeneratingPreview';

interface WebContainerPreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

export function WebContainerPreview({ projectFiles, isDark = false }: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerUrl, setContainerUrl] = useState<string>('');
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string>('');
  const webcontainerRef = useRef<WebContainer | null>(null);

  useEffect(() => {
    let mounted = true;

    const initWebContainer = async () => {
      try {
        setIsBooting(true);
        setError('');

        // Boot WebContainer
        console.log('🚀 Booting WebContainer...');
        const webcontainer = await WebContainer.boot();
        webcontainerRef.current = webcontainer;

        if (!mounted) return;

        // Préparer les fichiers pour WebContainer
        const files: Record<string, { file: { contents: string } }> = {};
        
        for (const [path, content] of Object.entries(projectFiles)) {
          files[path] = {
            file: {
              contents: content
            }
          };
        }

        // Écrire les fichiers
        console.log('📝 Writing project files...');
        await webcontainer.mount(files);

        // Installer les dépendances
        console.log('📦 Installing dependencies...');
        const installProcess = await webcontainer.spawn('npm', ['install']);
        
        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          throw new Error('npm install failed');
        }

        if (!mounted) return;

        // Lancer le serveur de dev
        console.log('🔥 Starting dev server...');
        const devProcess = await webcontainer.spawn('npm', ['run', 'dev']);

        // Écouter les logs
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('📡 Dev server:', data);
            },
          })
        );

        // Attendre que le serveur soit prêt
        webcontainer.on('server-ready', (port, url) => {
          if (!mounted) return;
          console.log('✅ Server ready at:', url);
          setContainerUrl(url);
          setIsBooting(false);
        });

      } catch (err) {
        console.error('❌ WebContainer error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to start WebContainer');
          setIsBooting(false);
        }
      }
    };

    initWebContainer();

    return () => {
      mounted = false;
      if (webcontainerRef.current) {
        webcontainerRef.current.teardown();
      }
    };
  }, [projectFiles]);

  if (isBooting) {
    return <GeneratingPreview />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold text-destructive">Preview Error</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!containerUrl) {
    return <GeneratingPreview />;
  }

  return (
    <div className="w-full h-full relative">
      <iframe
        ref={iframeRef}
        src={containerUrl}
        className="w-full h-full border-0"
        title="WebContainer Preview"
        allow="cross-origin-isolated"
      />
    </div>
  );
}
