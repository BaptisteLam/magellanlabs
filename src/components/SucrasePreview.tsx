import { useEffect, useRef, useMemo, useState } from 'react';
import { transform } from 'sucrase';
import { Button } from '@/components/ui/button';

interface SucrasePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onConsoleLog?: (log: { level: 'log' | 'error' | 'warn'; message: string }) => void;
}

export function SucrasePreview({ projectFiles, isDark = false, onConsoleLog }: SucrasePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  // MODE DEBUG - Afficher les informations
  useEffect(() => {
    const info = `
📦 Fichiers reçus: ${Object.keys(projectFiles).length}
📝 Liste: ${Object.keys(projectFiles).join(', ')}
🔍 Type: ${typeof projectFiles}
    `.trim();
    setDebugInfo(info);
    console.log(info);
  }, [projectFiles]);

  // Détecter le type de projet
  const isReactProject = useMemo(() => {
    return Object.keys(projectFiles).some(path => 
      path.includes('App.tsx') || 
      path.includes('App.jsx') || 
      path.includes('main.tsx') || 
      path.includes('main.jsx') ||
      path.includes('package.json')
    );
  }, [projectFiles]);

  // Transpiler et générer le HTML
  const generatedHTML = useMemo(() => {
    try {
      setError(null);
      console.log('🔧 Sucrase - Début transpilation');
      console.log('📦 Fichiers:', Object.keys(projectFiles));

      if (!projectFiles || Object.keys(projectFiles).length === 0) {
        return null;
      }

      // Pour HTML statique simple
      if (!isReactProject) {
        const htmlFile = Object.entries(projectFiles).find(([path]) => path.endsWith('.html'));
        if (htmlFile) {
          console.log('📄 HTML statique détecté');
          return htmlFile[1];
        }
      }

      // Pour projet React
      const modules: Record<string, { code: string; exports: any }> = {};
      const cssContent: string[] = [];

      // Normaliser les chemins (retirer / du début)
      const normalizedFiles: Record<string, string> = {};
      Object.entries(projectFiles).forEach(([path, content]) => {
        const normalized = path.startsWith('/') ? path.slice(1) : path;
        normalizedFiles[normalized] = content;
      });

      // Transpiler tous les fichiers .tsx/.jsx
      Object.entries(normalizedFiles).forEach(([path, content]) => {
        if (path.endsWith('.tsx') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.js')) {
          try {
            console.log(`⚙️ Transpilation: ${path}`);
            const result = transform(content, {
              transforms: ['jsx', 'typescript', 'imports'],
              jsxRuntime: 'automatic',
              production: false,
              filePath: path,
            });

            modules[path] = {
              code: result.code,
              exports: {},
            };
          } catch (err) {
            console.error(`❌ Erreur transpilation ${path}:`, err);
            throw new Error(`Erreur de transpilation dans ${path}: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (path.endsWith('.css')) {
          console.log(`🎨 CSS détecté: ${path}`);
          cssContent.push(content);
        }
      });

      // Trouver le point d'entrée
      const entryPoints = [
        'src/main.tsx',
        'src/index.tsx',
        'main.tsx',
        'index.tsx',
        'src/App.tsx',
        'App.tsx',
      ];

      const entryFile = entryPoints.find(entry => modules[entry]) || Object.keys(modules)[0];
      console.log('🎯 Point d\'entrée:', entryFile);

      if (!entryFile) {
        throw new Error('Aucun point d\'entrée trouvé');
      }

      // Fonction pour résoudre les imports relatifs
      const resolveImport = (from: string, to: string): string => {
        if (to.startsWith('.')) {
          const fromParts = from.split('/').slice(0, -1);
          const toParts = to.split('/');

          for (const part of toParts) {
            if (part === '..') {
              fromParts.pop();
            } else if (part !== '.') {
              fromParts.push(part);
            }
          }

          let resolved = fromParts.join('/');
          
          // Essayer avec différentes extensions
          const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
          for (const ext of extensions) {
            const candidate = resolved + ext;
            if (modules[candidate]) {
              return candidate;
            }
          }
          
          // Essayer index
          for (const ext of extensions) {
            const candidate = resolved + '/index' + ext;
            if (modules[candidate]) {
              return candidate;
            }
          }

          return resolved;
        }
        return to;
      };

      // Créer le code bundlé avec les modules React/ReactDOM globaux
      let bundledCode = `
        const modules = {};
        const moduleCache = {};
        
        // Modules factices pour React et ReactDOM
        modules['react'] = function(module, exports) {
          module.exports = window.React;
          module.exports.default = window.React;
        };
        
        modules['react-dom'] = function(module, exports) {
          module.exports = window.ReactDOM;
          module.exports.default = window.ReactDOM;
        };
        
        modules['react-dom/client'] = function(module, exports) {
          module.exports = {
            createRoot: window.ReactDOM.createRoot,
            default: { createRoot: window.ReactDOM.createRoot }
          };
        };
        
        modules['react/jsx-dev-runtime'] = function(module, exports) {
          module.exports = {
            jsxDEV: window.React.createElement
          };
        };
        
        function require(path) {
          if (moduleCache[path]) return moduleCache[path];
          
          if (!modules[path]) {
            console.error('Module non trouvé:', path);
            return {};
          }
          
          const module = { exports: {} };
          moduleCache[path] = module.exports;
          
          try {
            modules[path](module, module.exports, require);
          } catch (err) {
            console.error('Erreur dans le module', path, ':', err);
          }
          
          return module.exports;
        }
      `;

      // Ajouter tous les modules
      Object.entries(modules).forEach(([path, { code }]) => {
        // Remplacer les imports par des require()
        let processedCode = code;
        
        // Remplacer les imports de React
        processedCode = processedCode.replace(
          /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]react['"]/g,
          'const React = window.React'
        );
        processedCode = processedCode.replace(
          /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]react-dom[\/]client['"]/g,
          'const { createRoot } = window.ReactDOM'
        );
        processedCode = processedCode.replace(
          /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]react-dom['"]/g,
          'const ReactDOM = window.ReactDOM'
        );

        // Remplacer les imports relatifs
        const importRegex = /import\s+(?:{([^}]*)}|(\w+))\s+from\s+['"](\.\.?\/[^'"]+)['"]/g;
        processedCode = processedCode.replace(importRegex, (match, named, defaultImport, importPath) => {
          const resolved = resolveImport(path, importPath);
          if (named) {
            return `const {${named}} = require('${resolved}')`;
          } else {
            return `const ${defaultImport} = require('${resolved}')`;
          }
        });

        // Wrapper le module
        bundledCode += `
          modules['${path}'] = function(module, exports, require) {
            ${processedCode}
          };
        `;
      });

      // Ajouter le code d'initialisation React
      bundledCode += `
        try {
          const entryModule = require('${entryFile}');
          console.log('✅ Module d\'entrée chargé');
        } catch (err) {
          console.error('❌ Erreur au chargement:', err);
          document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: monospace;"><h2>Erreur de chargement</h2><pre>' + err.message + '</pre></div>';
        }
      `;

      // Construire le HTML final
      const html = `<!DOCTYPE html>
<html lang="fr" class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
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
    console.log('🔵 Iframe: Démarrage...');
    
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
      console.error('🔴 Runtime error:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('🔴 Unhandled promise rejection:', event.reason);
    });
  </script>
</head>
<body>
  <div id="root"></div>
  <script>
    console.log('🔵 Début chargement script...');
    
    // Attendre que React et ReactDOM soient chargés
    (function waitForReact() {
      if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
        console.log('✅ React et ReactDOM chargés');
        window.React = React;
        window.ReactDOM = ReactDOM;
        
        try {
          console.log('🔵 Exécution du code bundlé...');
          ${bundledCode}
          console.log('✅ Code bundlé exécuté avec succès');
        } catch (err) {
          console.error('❌ Erreur exécution code:', err);
          document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: monospace; background: ' + (${isDark} ? '#000' : '#fff') + ';"><h2>Erreur d\\'exécution</h2><pre>' + err.message + '\\n\\n' + err.stack + '</pre></div>';
        }
      } else {
        console.log('⏳ En attente de React/ReactDOM... (React: ' + typeof React + ', ReactDOM: ' + typeof ReactDOM + ')');
        setTimeout(waitForReact, 50);
      }
    })();
  </script>
</body>
</html>`;

      console.log('✅ HTML généré avec succès');
      console.log('📄 Taille HTML:', html.length, 'caractères');
      return html;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Erreur génération HTML:', errorMsg);
      setError(errorMsg);
      return null;
    }
  }, [projectFiles, isReactProject, isDark]);

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

  // Mettre à jour l'iframe quand le HTML change
  useEffect(() => {
    if (iframeRef.current && generatedHTML) {
      console.log('🔄 Mise à jour iframe');
      // Force un rechargement en réinitialisant srcdoc
      iframeRef.current.srcdoc = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = generatedHTML;
        }
      }, 0);
    }
  }, [generatedHTML]);

  // Debug: afficher les fichiers reçus
  console.log('📦 SucrasePreview - Fichiers reçus:', Object.keys(projectFiles));
  console.log('📦 Nombre de fichiers:', Object.keys(projectFiles).length);
  
  // TEST MODE: Afficher un HTML minimal pour tester l'iframe
  const testMode = false; // Mettez à true pour tester
  if (testMode) {
    const testHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: ${isDark ? '#1a1a1a' : '#ffffff'};
      color: ${isDark ? '#ffffff' : '#000000'};
      font-family: system-ui, -apple-system, sans-serif;
    }
    h1 {
      font-size: 3rem;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <h1>🎉 L'iframe fonctionne !</h1>
  <script>
    console.log('✅ Test iframe - JavaScript fonctionne');
    window.parent.postMessage({ type: 'console', level: 'log', message: '✅ Test iframe OK' }, '*');
  </script>
</body>
</html>`;
    
    return (
      <div className="w-full h-full overflow-hidden rounded-xl">
        <iframe
          title="Test Preview"
          srcDoc={testHTML}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }
  
  // DEBUG: Afficher l'état complet de projectFiles
  console.log('🔍 DEBUG SucrasePreview:', {
    projectFilesKeys: Object.keys(projectFiles),
    projectFilesCount: Object.keys(projectFiles).length,
    isReactProject,
    firstFilePreview: Object.keys(projectFiles)[0] ? {
      path: Object.keys(projectFiles)[0],
      contentLength: projectFiles[Object.keys(projectFiles)[0]]?.length,
      contentPreview: projectFiles[Object.keys(projectFiles)[0]]?.substring(0, 100)
    } : null
  });
  
  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground gap-4 p-8">
        <h2 className="text-2xl font-bold text-red-500">⚠️ Aucun fichier détecté</h2>
        <pre className="text-xs text-muted-foreground bg-muted p-4 rounded">{debugInfo}</pre>
        <p className="text-sm text-muted-foreground">Type: {typeof projectFiles}</p>
        <p className="text-sm text-muted-foreground">Keys: {JSON.stringify(Object.keys(projectFiles || {}))}</p>
        <Button 
          onClick={() => {
            console.log('📋 ProjectFiles:', projectFiles);
            console.log('📋 Type:', typeof projectFiles);
            console.log('📋 Keys:', Object.keys(projectFiles || {}));
          }}
          className="mt-4"
        >
          Afficher les détails dans la console
        </Button>
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
    console.log('⚠️ Pas de HTML généré');
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground gap-4 p-8">
        <h2 className="text-2xl font-bold text-yellow-500">⚠️ Pas de HTML généré</h2>
        <pre className="text-xs text-muted-foreground bg-muted p-4 rounded max-w-2xl">{debugInfo}</pre>
        <div className="text-left text-xs text-muted-foreground space-y-2 max-w-2xl">
          <p className="font-semibold">Fichiers détectés:</p>
          {Object.keys(projectFiles).map(key => (
            <div key={key} className="ml-4">
              <span className="text-primary">{key}</span>
              <span className="text-muted-foreground"> ({projectFiles[key]?.length || 0} chars)</span>
            </div>
          ))}
        </div>
        {error && (
          <div className="bg-destructive/10 p-4 rounded max-w-2xl">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
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
