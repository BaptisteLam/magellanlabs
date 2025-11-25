import { useEffect, useRef, useMemo, useState } from 'react';
import { transform } from '@babel/standalone';

interface BabelPreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onConsoleLog?: (log: { level: 'log' | 'error' | 'warn'; message: string }) => void;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function BabelPreview({ projectFiles, isDark = false, onConsoleLog, inspectMode = false, onElementSelect }: BabelPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        
        // Intercepter TOUS les clics sur liens pour isoler la preview
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href) {
            e.preventDefault();
            e.stopPropagation();
            const href = target.getAttribute('href') || '';
            
            // Bloquer TOUS les liens externes (http, https, mailto, tel, etc.)
            if (href.startsWith('http') || href.startsWith('//') || href.includes('magellan') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              // Afficher message d'erreur pour liens externes
              const errorDiv = document.createElement('div');
              errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#000;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;max-width:400px;text-align:center;font-family:system-ui;';
              errorDiv.innerHTML = \`
                <h3 style="margin:0 0 1rem 0;font-size:1.25rem;color:#dc2626;">🚫 Lien externe bloqué</h3>
                <p style="margin:0 0 1rem 0;color:#666;">Les liens externes sont désactivés dans la preview.</p>
                <button onclick="this.parentElement.remove()" style="background:rgb(3,165,192);color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:9999px;cursor:pointer;font-size:1rem;font-weight:500;">Fermer</button>
              \`;
              document.body.appendChild(errorDiv);
              setTimeout(() => errorDiv.remove(), 3000);
              return false;
            }
            
            // Pour les liens internes (comme #section)
            if (href.startsWith('#')) {
              // Laisser l'ancre fonctionner normalement
              e.preventDefault();
              const targetId = href.substring(1);
              const element = document.getElementById(targetId);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
              return false;
            }
            
            // Pour les autres liens internes (pages du site)
            const pathname = href.replace(/^\//, '');
            
            // Si c'est la page d'accueil ou vide
            if (!pathname || pathname === 'index.html' || pathname === '/') {
              return false;
            }
            
            // Pour toute autre page, afficher un message
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#000;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;max-width:400px;text-align:center;font-family:system-ui;';
            errorDiv.innerHTML = \`
              <h3 style="margin:0 0 1rem 0;font-size:1.25rem;color:#f59e0b;">⚠️ Page introuvable</h3>
              <p style="margin:0 0 1rem 0;color:#666;">La page "\${pathname}" n'existe pas encore dans ce projet.</p>
              <button onclick="this.parentElement.remove()" style="background:rgb(3,165,192);color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:9999px;cursor:pointer;font-size:1rem;font-weight:500;">Fermer</button>
            \`;
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
            return false;
          }
        }, true);
        
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
          let processedCode = code;
          
          // 1. import React from 'react' → const React = require('react')
          processedCode = processedCode.replace(
            /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            'const $1 = require("$2")'
          );
          
          // 2. import { Component } from 'react' → const { Component } = require('react')
          processedCode = processedCode.replace(
            /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
            'const {$1} = require("$2")'
          );
          
          // 3. import * as Name from 'module' → const Name = require('module')
          processedCode = processedCode.replace(
            /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            'const $1 = require("$2")'
          );
          
          // 4. Normaliser les chemins relatifs
          processedCode = processedCode.replace(
            /require\(["'](\.[^"']+)["']\)/g,
            (match, relativePath) => {
              const dir = path.split('/').slice(0, -1).join('/');
              let resolved = relativePath;
              
              if (relativePath.startsWith('./')) {
                resolved = dir + '/' + relativePath.substring(2);
              } else if (relativePath.startsWith('../')) {
                const parts = dir.split('/');
                let upCount = 0;
                let rest = relativePath;
                while (rest.startsWith('../')) {
                  upCount++;
                  rest = rest.substring(3);
                }
                resolved = parts.slice(0, -upCount).join('/') + '/' + rest;
              }
              
              if (!resolved.match(/\.(tsx?|jsx?)$/)) {
                const extensions = ['.tsx', '.ts', '.jsx', '.js'];
                for (const ext of extensions) {
                  if (transpiledModules[resolved + ext]) {
                    resolved += ext;
                    break;
                  }
                }
              }
              
              return `require("${resolved}")`;
            }
          );
          
          // 5. Transformer les exports
          processedCode = processedCode.replace(
            /export\s+default\s+/g,
            'module.exports = '
          );
          
          processedCode = processedCode.replace(
            /export\s+\{([^}]+)\}/g,
            (match, exports) => {
              const items = exports.split(',').map(e => e.trim());
              return items.map(item => `exports.${item} = ${item};`).join('\n');
            }
          );
          
          processedCode = processedCode.replace(
            /export\s+(const|let|var|function|class)\s+(\w+)/g,
            '$1 $2'
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
    
    // Script d'inspection pour le mode édition visuelle
    (function() {
      let isInspectMode = false;
      let hoveredElement = null;
      
      console.log('🔍 Magellan Inspect (Babel): Script chargé');
      
      // Styles CSS pour l'inspection
      const style = document.createElement('style');
      style.id = '__magellan_inspect_styles__';
      style.textContent = \`
        .magellan-inspect-highlight {
          outline: 2px solid #03A5C0 !important;
          outline-offset: 2px !important;
          cursor: pointer !important;
          position: relative;
        }
        .magellan-inspect-highlight::after {
          content: attr(data-magellan-tag);
          position: absolute;
          top: -24px;
          left: 0;
          background: #03A5C0;
          color: white;
          padding: 2px 8px;
          font-size: 11px;
          font-family: monospace;
          font-weight: 600;
          border-radius: 4px;
          pointer-events: none;
          z-index: 999999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .magellan-inspect-dashed {
          outline: 1px dashed rgba(3, 165, 192, 0.3) !important;
          outline-offset: 2px;
        }
      \`;
      document.head.appendChild(style);
      
      // Écouter les messages du parent
      window.addEventListener('message', (e) => {
        console.log('📨 Message reçu (Babel):', e.data);
        if (e.data.type === 'toggle-inspect') {
          isInspectMode = e.data.enabled;
          console.log('🎯 Mode inspect (Babel):', isInspectMode);
          
          if (isInspectMode) {
            activateInspection();
          } else {
            deactivateInspection();
          }
        }
      });
      
      function activateInspection() {
        console.log('✅ Activation du mode inspection (Babel)');
        document.body.style.cursor = 'crosshair';
        showAllOutlines();
      }
      
      function deactivateInspection() {
        console.log('❌ Désactivation du mode inspection (Babel)');
        document.body.style.cursor = 'default';
        if (hoveredElement) {
          hoveredElement.classList.remove('magellan-inspect-highlight');
          hoveredElement.removeAttribute('data-magellan-tag');
          hoveredElement = null;
        }
        hideAllOutlines();
      }
      
      function showAllOutlines() {
        const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
        document.querySelectorAll(selectableTags.join(',')).forEach(el => {
          if (el !== document.body && el !== document.documentElement) {
            el.classList.add('magellan-inspect-dashed');
          }
        });
      }
      
      function hideAllOutlines() {
        document.querySelectorAll('.magellan-inspect-dashed').forEach(el => {
          el.classList.remove('magellan-inspect-dashed');
        });
      }
      
      function getElementDescription(el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'h1') return 'Titre H1';
        if (tag === 'h2') return 'Titre H2';
        if (tag === 'h3') return 'Titre H3';
        if (tag === 'img') return 'Image';
        if (tag === 'button') return 'Bouton';
        if (tag === 'a') return 'Lien';
        if (tag === 'p') return 'Paragraphe';
        return tag.toUpperCase();
      }
      
      function getElementPath(element) {
        const path = [];
        let current = element;
        
        while (current && current !== document.body && current !== document.documentElement) {
          let selector = current.tagName.toLowerCase();
          
          if (current.id) {
            selector += '#' + current.id;
          } else if (current.className) {
            const classes = Array.from(current.classList)
              .filter(c => !c.startsWith('magellan-inspect'))
              .join('.');
            if (classes) selector += '.' + classes;
          }
          
          path.unshift(selector);
          current = current.parentElement;
        }
        
        return path.join(' > ');
      }
      
      // Détection au survol avec mousemove
      document.addEventListener('mousemove', (e) => {
        if (!isInspectMode) return;
        
        const target = e.target;
        if (target === hoveredElement) return;
        if (target === document.body || target === document.documentElement) return;
        
        const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
        if (!selectableTags.includes(target.tagName)) return;
        
        if (hoveredElement) {
          hoveredElement.classList.remove('magellan-inspect-highlight');
          hoveredElement.removeAttribute('data-magellan-tag');
        }
        
        hoveredElement = target;
        const elementType = getElementDescription(target);
        target.setAttribute('data-magellan-tag', elementType);
        target.classList.add('magellan-inspect-highlight');
      }, true);
      
      // Sélection au clic
      document.addEventListener('click', (e) => {
        if (!isInspectMode) return;
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const target = e.target;
        if (target === document.body || target === document.documentElement) return;
        
        console.log('🎯 Élément cliqué (Babel):', target.tagName);
        
        const rect = target.getBoundingClientRect();
        const elementInfo = {
          tagName: target.tagName,
          textContent: target.textContent?.substring(0, 200) || '',
          classList: Array.from(target.classList).filter(c => !c.startsWith('magellan-inspect')),
          path: getElementPath(target),
          innerHTML: target.innerHTML,
          id: target.id || undefined,
          boundingRect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
            right: rect.right
          }
        };
        
        console.log('📤 Envoi au parent (Babel):', elementInfo);
        window.parent.postMessage({
          type: 'element-selected',
          data: elementInfo
        }, '*');
        
        return false;
      }, true);
      
      console.log('✅ Magellan Inspect (Babel): Prêt');
    })();
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
      if (event.data.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
      
      // Gérer le rechargement de la preview
      if (event.data.type === 'reload') {
        console.log('🔄 Rechargement de la preview Babel...');
        setReloadKey(prev => prev + 1);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConsoleLog, onElementSelect]);

  // Mettre à jour l'iframe et envoyer l'état du mode inspection
  useEffect(() => {
    if (iframeRef.current && generatedHTML) {
      iframeRef.current.srcdoc = generatedHTML;
      
      // Envoyer l'état du mode inspection après le chargement de l'iframe avec plusieurs tentatives
      const sendInspectMode = () => {
        if (iframeRef.current?.contentWindow) {
          console.log('📤 BabelPreview - Envoi toggle-inspect:', inspectMode);
          iframeRef.current.contentWindow.postMessage({
            type: 'toggle-inspect',
            enabled: inspectMode
          }, '*');
        }
      };
      
      // Attendre que l'iframe soit chargée et envoyer plusieurs fois
      const iframe = iframeRef.current;
      const onLoad = () => {
        sendInspectMode();
        setTimeout(sendInspectMode, 100);
        setTimeout(sendInspectMode, 300);
        setTimeout(sendInspectMode, 500);
      };
      
      iframe.addEventListener('load', onLoad);
      
      return () => iframe.removeEventListener('load', onLoad);
    }
  }, [generatedHTML, inspectMode, reloadKey]);

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
