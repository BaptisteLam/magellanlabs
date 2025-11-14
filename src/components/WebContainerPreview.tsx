import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';

interface WebContainerPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function WebContainerPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const webcontainerRef = useRef<WebContainer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const initWebContainer = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Boot WebContainer
        if (!webcontainerRef.current) {
          webcontainerRef.current = await WebContainer.boot();
        }

        const webcontainer = webcontainerRef.current;

        // Normaliser les fichiers
        const normalizedFiles: Record<string, string> = {};
        Object.entries(projectFiles).forEach(([path, content]) => {
          if (typeof content === 'string') {
            normalizedFiles[path] = content;
          } else if (content && typeof content === 'object' && 'code' in content) {
            normalizedFiles[path] = content.code;
          }
        });

        // Créer la structure de fichiers pour WebContainer
        const fileTree: any = {};
        
        Object.entries(normalizedFiles).forEach(([path, content]) => {
          const parts = path.startsWith('/') ? path.slice(1).split('/') : path.split('/');
          let current = fileTree;
          
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = { directory: {} };
            }
            current = current[parts[i]].directory;
          }
          
          current[parts[parts.length - 1]] = {
            file: { contents: content }
          };
        });

        // Ajouter package.json si absent
        if (!fileTree['package.json']) {
          fileTree['package.json'] = {
            file: {
              contents: JSON.stringify({
                name: 'preview-app',
                version: '1.0.0',
                type: 'module',
                scripts: {
                  dev: 'vite',
                  build: 'vite build',
                  preview: 'vite preview'
                },
                dependencies: {
                  react: '^18.3.1',
                  'react-dom': '^18.3.1'
                },
                devDependencies: {
                  '@types/react': '^18.3.1',
                  '@types/react-dom': '^18.3.1',
                  '@vitejs/plugin-react-swc': '^3.5.0',
                  typescript: '^5.2.2',
                  vite: '^5.0.0',
                  tailwindcss: '^3.4.0',
                  autoprefixer: '^10.4.16',
                  postcss: '^8.4.32'
                }
              }, null, 2)
            }
          };
        }

        // Ajouter vite.config.ts si absent
        if (!fileTree['vite.config.ts']) {
          fileTree['vite.config.ts'] = {
            file: {
              contents: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
});`
            }
          };
        }

        // Ajouter tsconfig.json si absent
        if (!fileTree['tsconfig.json']) {
          fileTree['tsconfig.json'] = {
            file: {
              contents: JSON.stringify({
                compilerOptions: {
                  target: 'ES2020',
                  useDefineForClassFields: true,
                  lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                  module: 'ESNext',
                  skipLibCheck: true,
                  moduleResolution: 'bundler',
                  allowImportingTsExtensions: true,
                  resolveJsonModule: true,
                  isolatedModules: true,
                  noEmit: true,
                  jsx: 'react-jsx',
                  strict: true,
                  noUnusedLocals: true,
                  noUnusedParameters: true,
                  noFallthroughCasesInSwitch: true
                },
                include: ['src']
              }, null, 2)
            }
          };
        }

        // Monter les fichiers
        await webcontainer.mount(fileTree);

        // Installer les dépendances
        const installProcess = await webcontainer.spawn('npm', ['install']);
        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          throw new Error('Failed to install dependencies');
        }

        // Démarrer le serveur de dev
        const devProcess = await webcontainer.spawn('npm', ['run', 'dev']);

        // Écouter l'URL du serveur
        webcontainer.on('server-ready', (port, url) => {
          if (mounted) {
            setPreviewUrl(url);
            setIsLoading(false);
          }
        });

        // Gérer les erreurs du processus
        devProcess.output.pipeTo(new WritableStream({
          write(data) {
            console.log('[WebContainer]', data);
          }
        }));

      } catch (err) {
        console.error('WebContainer error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize preview');
          setIsLoading(false);
        }
      }
    };

    initWebContainer();

    return () => {
      mounted = false;
    };
  }, [projectFiles]);

  // Gérer le mode inspection
  useEffect(() => {
    if (iframeRef.current?.contentWindow && previewUrl) {
      iframeRef.current.contentWindow.postMessage({
        type: 'toggle-inspect',
        enabled: inspectMode
      }, '*');
    }
  }, [inspectMode, previewUrl]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Initializing preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6">
          <div className="text-red-500 text-xl">⚠️</div>
          <p className="text-foreground font-medium">Preview Error</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={previewUrl}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
      title="Preview"
    />
  );
}
