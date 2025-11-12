import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { GeneratingPreview } from './GeneratingPreview';

interface WebContainerPreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

// Instance singleton globale de WebContainer
let globalWebContainer: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (globalWebContainer) {
    return globalWebContainer;
  }
  
  if (!bootPromise) {
    console.log('🚀 Booting WebContainer (singleton)...');
    bootPromise = WebContainer.boot();
    globalWebContainer = await bootPromise;
    bootPromise = null;
  } else {
    await bootPromise;
  }
  
  return globalWebContainer!;
}

export function WebContainerPreview({ projectFiles, isDark = false }: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerUrl, setContainerUrl] = useState<string>('');
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const initWebContainer = async () => {
      try {
        setIsBooting(true);
        setError('');

        // Réutiliser l'instance singleton
        const webcontainer = await getWebContainer();

        if (!mounted) return;

        // Préparer les fichiers pour WebContainer
        const files: Record<string, { file: { contents: string } } | { directory: {} }> = {};
        
        for (const [path, content] of Object.entries(projectFiles)) {
          const parts = path.split('/');
          let current = files;
          
          for (let i = 0; i < parts.length - 1; i++) {
            const dir = parts[i];
            if (!current[dir]) {
              current[dir] = { directory: {} };
            }
          }
          
          const fileName = parts[parts.length - 1];
          files[fileName] = {
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
        
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('📦 npm install:', data);
            },
          })
        );

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
