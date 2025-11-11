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

      // Collecter tous les fichiers CSS
      const cssContent: string[] = [];
      Object.entries(projectFiles).forEach(([path, content]) => {
        if (path.endsWith('.css')) {
          cssContent.push(content);
        }
      });

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
      
      // Si pas de point d'entrée React, chercher un fichier HTML
      if (!entryFile) {
        const htmlFile = Object.entries(projectFiles).find(([path]) => path.endsWith('.html'));
        if (htmlFile) {
          return htmlFile[1];
        }
        throw new Error('Aucun point d\'entrée trouvé');
      }

      // Transpiler tous les fichiers TS/TSX/JS/JSX avec Babel
      const transpiledModules: Record<string, string> = {};
      
      Object.entries(projectFiles).forEach(([path, content]) => {
        if (path.match(/\.(tsx?|jsx?)$/)) {
          try {
            const result = transform(content, {
              filename: path,
              presets: [
                ['react', { runtime: 'classic' }],
                'typescript'
              ],
              retainLines: false,
            });
            
            if (result.code) {
              transpiledModules[path] = result.code;
            }
          } catch (err) {
            console.error(`Erreur transpilation ${path}:`, err);
            throw new Error(`Erreur de transpilation dans ${path}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });

      // Créer un système de modules simple
      const bundleCode = `
        const modules = {};
        const moduleCache = {};
        
        // Mock pour React et ReactDOM
        const React = window.React;
        const ReactDOM = window.ReactDOM;
        
        function require(moduleName) {
          // Modules externes
          if (moduleName === 'react') return React;
          if (moduleName === 'react-dom') return ReactDOM;
          if (moduleName === 'react-dom/client') return { createRoot: ReactDOM.createRoot };
          
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
          // Remplacer les imports par des require()
          let processedCode = code;
          
          // Remplacer tous les types d'imports React
          processedCode = processedCode.replace(
            /import\s+(?:React(?:\s*,\s*\{[^}]*\})?|\{[^}]*\})\s+from\s+['"]react['"]/g,
            'const React = require("react")'
          );
          
          // Remplacer import * as React
          processedCode = processedCode.replace(
            /import\s+\*\s+as\s+React\s+from\s+['"]react['"]/g,
            'const React = require("react")'
          );
          
          // Remplacer import ReactDOM
          processedCode = processedCode.replace(
            /import\s+ReactDOM\s+from\s+['"]react-dom['"]/g,
            'const ReactDOM = require("react-dom")'
          );
          
          // Remplacer import { createRoot } from 'react-dom/client'
          processedCode = processedCode.replace(
            /import\s+\{([^}]+)\}\s+from\s+['"]react-dom\/client['"]/g,
            'const { $1 } = require("react-dom/client")'
          );
          
          // Remplacer les imports relatifs
          processedCode = processedCode.replace(
            /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"](\..+?)['"]/g,
            (match, named, defaultImport, importPath) => {
              // Résoudre le chemin relatif
              const fromParts = path.split('/').slice(0, -1);
              const toParts = importPath.split('/');
              
              for (const part of toParts) {
                if (part === '..') fromParts.pop();
                else if (part !== '.') fromParts.push(part);
              }
              
              let resolved = fromParts.join('/');
              
              // Essayer différentes extensions
              const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
              for (const ext of extensions) {
                if (transpiledModules[resolved + ext]) {
                  resolved = resolved + ext;
                  break;
                }
              }
              
              if (named) {
                return `const { ${named} } = require("${resolved}")`;
              } else {
                return `const ${defaultImport} = require("${resolved}")`;
              }
            }
          );
          
          // Remplacer les imports de CSS (les ignorer)
          processedCode = processedCode.replace(
            /import\s+['"][^'"]+\.css['"]/g,
            '// CSS import removed'
          );
          
          // Gérer les exports
          processedCode = processedCode.replace(
            /export\s+default\s+/g,
            'module.exports = '
          );
          
          processedCode = processedCode.replace(
            /export\s+\{([^}]+)\}/g,
            (match, exports) => {
              const exportList = exports.split(',').map(e => e.trim());
              return exportList.map(exp => `module.exports.${exp} = ${exp};`).join('\\n');
            }
          );
          
          return `modules["${path}"] = function(module, exports, require) {
            ${processedCode}
          };`;
        }).join('\\n')}
        
        // Charger le point d'entrée
        try {
          require('${entryFile}');
        } catch (err) {
          console.error('Erreur au chargement:', err);
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
