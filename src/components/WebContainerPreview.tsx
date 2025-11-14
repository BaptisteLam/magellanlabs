import { useEffect, useRef, useState } from 'react';
import { getWebContainer } from '@/lib/webcontainerSingleton';

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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string>('');
  const processRef = useRef<any>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    async function bootAndRun() {
      try {
        setIsBooting(true);
        setError('');

        // Récupérer l'instance unique de WebContainer
        const webcontainer = await getWebContainer();

        if (!mountedRef.current) return;

        // Sanitizer les fichiers d'entrée pour supprimer toute référence non-clonable
        const sanitizedInput = JSON.parse(JSON.stringify(projectFiles));

        // Normaliser les fichiers
        const normalizedFiles: Record<string, string> = {};
        Object.entries(sanitizedInput).forEach(([path, content]) => {
          if (typeof content === 'string') {
            normalizedFiles[path] = content;
          } else if (content && typeof content === 'object' && 'code' in content) {
            normalizedFiles[path] = String((content as any).code);
          }
        });

        // Créer la structure de fichiers pour WebContainer (objets purs uniquement)
        const files: Record<string, any> = {};
        Object.entries(normalizedFiles).forEach(([path, content]) => {
          const parts = path.split('/');
          let current = files;
          
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = { directory: {} };
            }
            current = current[parts[i]].directory;
          }
          
          current[parts[parts.length - 1]] = {
            file: { contents: String(content) }
          };
        });


        // Ajouter package.json si manquant
        if (!files['package.json']) {
          files['package.json'] = {
            file: {
              contents: JSON.stringify({
                name: 'preview-app',
                type: 'module',
                dependencies: {
                  'react': '^18.3.1',
                  'react-dom': '^18.3.1',
                  'vite': '^5.4.0',
                  '@vitejs/plugin-react': '^4.3.0'
                },
                scripts: {
                  dev: 'vite --port 3000'
                }
              }, null, 2)
            }
          };
        }

        // Ajouter vite.config.js si manquant
        if (!files['vite.config.js'] && !files['vite.config.ts']) {
          files['vite.config.js'] = {
            file: {
              contents: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  }
});`
            }
          };
        }

        // Ajouter index.html si manquant
        if (!files['index.html']) {
          files['index.html'] = {
            file: {
              contents: `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
            }
          };
        }

        console.log('📦 Mounting files...');
        await webcontainer.mount(files);

        if (!mountedRef.current) return;

        // Tuer l'ancien process s'il existe
        if (processRef.current) {
          console.log('🔪 Killing old process...');
          try {
            processRef.current.kill();
          } catch (e) {
            console.warn('Failed to kill process:', e);
          }
          processRef.current = null;
        }

        // Installer les dépendances
        console.log('📥 Installing dependencies...');
        const installProcess = await webcontainer.spawn('npm', ['install']);
        
        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          throw new Error('Failed to install dependencies');
        }

        if (!mountedRef.current) return;

        console.log('🚀 Starting dev server...');
        processRef.current = await webcontainer.spawn('npm', ['run', 'dev']);

        processRef.current.output.pipeTo(new WritableStream({
          write(data) {
            console.log('📦 Dev server:', data);
          }
        }));

        // Écouter l'événement server-ready
        webcontainer.on('server-ready', (port, url) => {
          console.log('✅ Server ready at', url);
          if (mountedRef.current) {
            setPreviewUrl(url);
            setIsBooting(false);
          }
        });

      } catch (err: any) {
        console.error('❌ Error in WebContainer:', err);
        if (mountedRef.current) {
          setError(err.message || 'Failed to boot WebContainer');
          setIsBooting(false);
        }
      }
    }

    bootAndRun();

    return () => {
      mountedRef.current = false;
      // Tuer le process au démontage
      if (processRef.current) {
        try {
          processRef.current.kill();
        } catch (e) {
          console.warn('Failed to kill process on unmount:', e);
        }
        processRef.current = null;
      }
    };
  }, [projectFiles]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Erreur WebContainer</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (isBooting || !previewUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="text-4xl mb-4 animate-pulse">⚡</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Démarrage du serveur</h2>
          <p className="text-muted-foreground">
            Installation et build en cours...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {Object.keys(projectFiles).length} fichiers chargés
          </p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={previewUrl}
      className="w-full h-full border-0"
      title="Preview"
      allow="cross-origin-isolated"
    />
  );
}
