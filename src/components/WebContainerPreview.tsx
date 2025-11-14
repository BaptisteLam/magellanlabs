import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import WebContainerSingleton from '@/lib/webcontainerSingleton';

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
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string>('');
  const hasBootedRef = useRef(false);
  const processRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function bootWebContainer() {
      // Utiliser le singleton pour éviter "Unable to create more instances"
      if (webcontainerRef.current) {
        console.log('⚠️ WebContainer already exists, updating files instead');
        await updateFiles();
        return;
      }

      try {
        console.log('🚀 Récupération WebContainer singleton...');
        setIsBooting(true);
        setError('');

        // Utiliser le singleton au lieu de créer une nouvelle instance
        const webcontainer = await WebContainerSingleton.getInstance();
        webcontainerRef.current = webcontainer;
        console.log('✅ WebContainer singleton récupéré');

        if (!mounted) return;

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
            file: { contents: content }
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
  server: { port: 3000 }
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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

        console.log('📁 Mounting files...', Object.keys(files));
        await webcontainer.mount(files);
        console.log('✅ Files mounted');

        if (!mounted) return;

        // Installer les dépendances
        console.log('📦 Installing dependencies...');
        const installProcess = await webcontainer.spawn('npm', ['install']);
        
        installProcess.output.pipeTo(new WritableStream({
          write(data) {
            console.log('npm install:', data);
          }
        }));

        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          throw new Error('Installation failed');
        }
        console.log('✅ Dependencies installed');

        if (!mounted) return;

        // Démarrer le serveur dev
        console.log('🔥 Starting dev server...');
        const devProcess = await webcontainer.spawn('npm', ['run', 'dev']);
        
        devProcess.output.pipeTo(new WritableStream({
          write(data) {
            console.log('dev server:', data);
          }
        }));

        // Attendre que le serveur soit prêt
        webcontainer.on('server-ready', (port, url) => {
          console.log('✅ Server ready:', url);
          if (mounted) {
            setPreviewUrl(url);
            setIsBooting(false);
          }
        });

      } catch (err) {
        console.error('❌ WebContainer error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to boot WebContainer');
          setIsBooting(false);
        }
      }
    }

    async function updateFiles() {
      if (!webcontainerRef.current) return;
      
      try {
        console.log('📝 Updating files in existing WebContainer...');
        const normalizedFiles: Record<string, string> = {};
        Object.entries(projectFiles).forEach(([path, content]) => {
          if (typeof content === 'string') {
            normalizedFiles[path] = content;
          } else if (content && typeof content === 'object' && 'code' in content) {
            normalizedFiles[path] = content.code;
          }
        });

        // Mettre à jour les fichiers un par un
        for (const [path, content] of Object.entries(normalizedFiles)) {
          await webcontainerRef.current.fs.writeFile(path, content);
        }
        console.log('✅ Files updated');

        // Redémarrer le processus pour recharger les modifications
        if (processRef.current) {
          console.log('🔄 Restarting dev server...');
          processRef.current.kill();
          processRef.current = await webcontainerRef.current.spawn('npm', ['run', 'dev']);
          
          processRef.current.output.pipeTo(new WritableStream({
            write(data) {
              console.log('📦 Server output:', data);
            }
          }));
        }
      } catch (err) {
        console.error('❌ Error updating files:', err);
      }
    }

    bootWebContainer();

    return () => {
      mounted = false;
      // Ne pas teardown ici pour éviter de détruire l'instance trop tôt
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
          <h2 className="text-xl font-semibold text-foreground mb-2">Démarrage WebContainer</h2>
          <p className="text-muted-foreground">
            {!webcontainerRef.current ? 'Boot du container...' : 
             !previewUrl ? 'Installation et build...' : 
             'Chargement...'}
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
