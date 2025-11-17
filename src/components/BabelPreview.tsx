import { useEffect, useRef, useMemo, useState } from 'react';
import { transform } from '@babel/standalone';

interface BabelPreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onConsoleLog?: (log: { level: 'log' | 'error' | 'warn'; message: string }) => void;
}

export function BabelPreview({ projectFiles, isDark = false, onConsoleLog }: BabelPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Générer le HTML avec transpilation Babel
  const generatedHTML = useMemo(() => {
    try {
      setError(null);
      
      if (!projectFiles || Object.keys(projectFiles).length === 0) {
        return null;
      }

      // Collecter tous les fichiers CSS et assets
      const cssContent: string[] = [];
      const assets: Record<string, string> = {};
      
      Object.entries(projectFiles).forEach(([path, content]) => {
        if (path.endsWith('.css')) {
          cssContent.push(content);
        }
        // Convertir les images en data URLs
        if (path.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
          // Pour les images, on suppose qu'elles sont déjà en base64 ou on les marque comme assets
          assets[path] = content;
        }
      });

      // Log pour debug
      console.log('📁 Fichiers disponibles:', Object.keys(projectFiles));
      
      // Trouver le point d'entrée principal
      const entryPoints = [
        'src/main.tsx',
        'src/index.tsx',
        'src/main.jsx',
        'src/index.jsx',
        'main.tsx',
        'index.tsx',
        'src/App.tsx',
        'App.tsx',
      ];

      let entryFile = entryPoints.find(entry => projectFiles[entry]);
      
      console.log('🎯 Point d\'entrée trouvé:', entryFile);
      
      // Si pas de point d'entrée React, chercher un fichier HTML
      if (!entryFile) {
        const htmlFile = Object.entries(projectFiles).find(([path]) => path.endsWith('.html'));
        if (htmlFile) {
          console.log('📄 Utilisation du fichier HTML:', htmlFile[0]);
          return htmlFile[1];
        }
        throw new Error('Aucun point d\'entrée trouvé. Fichiers: ' + Object.keys(projectFiles).join(', '));
      }

      // Transpiler tous les fichiers TS/TSX/JS/JSX avec Babel
      const transpiledModules: Record<string, string> = {};
      
      Object.entries(projectFiles).forEach(([path, content]) => {
        if (path.match(/\.(tsx?|jsx?)$/)) {
          try {
            console.log(`⚙️ Transpilation de ${path}...`);
      const result = transform(content, {
        filename: path,
        presets: [
          ['env', { 
            modules: 'commonjs',
            loose: true,
            targets: { esmodules: false }
          }],
          ['react', { runtime: 'classic' }],
          'typescript'
        ],
        retainLines: false,
      });
            
            if (result.code) {
              transpiledModules[path] = result.code;
              console.log(`✅ ${path} transpilé (${result.code.length} chars)`);
            }
          } catch (err) {
            console.error(`❌ Erreur transpilation ${path}:`, err);
            throw new Error(`Erreur de transpilation dans ${path}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
      
      console.log('📦 Modules transpilés:', Object.keys(transpiledModules));

      // Créer un système de modules simple
      const bundleCode = `
        const modules = {};
        const moduleCache = {};
        
        // Assets embarqués
        const assets = ${JSON.stringify(assets)};
        
        // Mock pour React et ReactDOM
        const React = window.React;
        const ReactDOM = window.ReactDOM;
        
        function require(moduleName) {
          // Modules externes
          if (moduleName === 'react') return React;
          if (moduleName === 'react-dom') return ReactDOM;
          if (moduleName === 'react-dom/client') return { createRoot: ReactDOM.createRoot };
          
          // Assets (images, etc.)
          if (assets[moduleName]) {
            return assets[moduleName];
          }
          
          // Modules du projet
          if (moduleCache[moduleName]) return moduleCache[moduleName];
          
          if (!modules[moduleName]) {
            console.error('Module non trouvé:', moduleName);
            return {};
          }
          
          const module = { exports: {} };
          moduleCache[moduleName] = module.exports;
          
          try {
            modules[moduleName](module, module.exports, require);
          } catch (err) {
            console.error('Erreur dans le module', moduleName, ':', err);
            throw err;
          }
          
          return module.exports;
        }
        
        ${Object.entries(transpiledModules).map(([path, code]) => {
          // Babel avec preset 'env' devrait avoir transformé tous les imports
          // Mais on garde une sécurité pour les imports externes
          let processedCode = code;
          
          // Remplacer uniquement les imports externes (node_modules) qui pourraient rester
          // Les imports relatifs devraient déjà être transformés par Babel
          processedCode = processedCode.replace(
            /import\s+.*?from\s+['"](?!\.)[^'"]+['"]/g,
            '// External import handled by require system'
          );
          
          return `modules["${path}"] = function(module, exports, require) {
            ${processedCode}
          };`;
        }).join('\\n')}
        
        // Charger le point d'entrée
        console.log('🚀 Chargement du point d\'entrée:', '${entryFile}');
        console.log('📚 Modules disponibles:', Object.keys(modules));
        try {
          require('${entryFile}');
          console.log('✅ Application chargée avec succès');
        } catch (err) {
          console.error('❌ Erreur au chargement:', err);
          document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: monospace;"><h2>Erreur de chargement</h2><pre>' + err.message + '\\n\\n' + (err.stack || '') + '</pre></div>';
        }
      `;

      // Construire le HTML final
      const html = `<!DOCTYPE html>
<html lang="fr" class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${isDark ? '#000' : '#fff'};
      color: ${isDark ? '#fff' : '#000'};
    }
    #root {
      min-height: 100vh;
    }
    ${cssContent.join('\n')}
  </style>
  <script>
    // Intercepter les console logs
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };
    
    ['log', 'error', 'warn'].forEach(level => {
      console[level] = function(...args) {
        originalConsole[level].apply(console, args);
        window.parent.postMessage({
          type: 'console',
          level: level,
          message: args.map(arg => {
            try {
              return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
            } catch {
              return String(arg);
            }
          }).join(' ')
        }, '*');
      };
    });
    
    // Capturer les erreurs
    window.addEventListener('error', (event) => {
      console.error('Runtime error:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  </script>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        document.body.innerHTML = '<div style="color: red; padding: 20px;">Erreur: React non chargé</div>';
        return;
      }
      
      window.React = React;
      window.ReactDOM = ReactDOM;
      
      try {
        ${bundleCode}
      } catch (err) {
        console.error('Erreur exécution:', err);
        document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: monospace;"><h2>Erreur d\\'exécution</h2><pre>' + err.message + '\\n\\n' + (err.stack || '') + '</pre></div>';
      }
    })();
  </script>
</body>
</html>`;

      return html;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Erreur génération HTML:', errorMsg);
      setError(errorMsg);
      return null;
    }
  }, [projectFiles, isDark]);

  // Intercepter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'console' && onConsoleLog) {
        onConsoleLog({
          level: event.data.level,
          message: event.data.message,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConsoleLog]);

  // Mettre à jour l'iframe
  useEffect(() => {
    if (iframeRef.current && generatedHTML) {
      iframeRef.current.srcdoc = generatedHTML;
    }
  }, [generatedHTML]);

  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-foreground">
        <p className="text-muted-foreground">Aucun fichier à prévisualiser</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground p-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-2xl">
          <h2 className="text-xl font-semibold text-destructive mb-4">Erreur de compilation</h2>
          <pre className="text-sm text-destructive/90 whitespace-pre-wrap font-mono">{error}</pre>
        </div>
      </div>
    );
  }

  if (!generatedHTML) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-foreground">
        <p className="text-muted-foreground">Génération de la prévisualisation...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl">
      <iframe
        ref={iframeRef}
        title="Preview"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      />
    </div>
  );
}
