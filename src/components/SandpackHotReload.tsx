import { useEffect, useRef, useState, useCallback } from 'react';
import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { HotReloadIndicator } from './HotReloadIndicator';
import { type ElementInfo } from './InspectOverlay';

interface SandpackHotReloadProps {
  files: Record<string, string>;
  isDark: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
}

// Convertir les fichiers du projet vers le format Sandpack
function convertToSandpackFiles(files: Record<string, string>): Record<string, string> {
  const sandpackFiles: Record<string, string> = {};
  
  console.log('🔄 convertToSandpackFiles - Input files:', Object.keys(files));
  
  // Vérifier si c'est déjà un projet React/TypeScript généré par Claude
  const hasReactProject = Object.keys(files).some(f => 
    f.includes('App.tsx') || f.includes('App.jsx') || 
    f.includes('main.tsx') || f.includes('src/main.tsx') ||
    f.includes('package.json')
  );
  
  if (hasReactProject) {
    console.log('✅ Projet React détecté - utilisation directe des fichiers');
    
    // Projet React existant - normaliser les chemins pour Sandpack
    Object.entries(files).forEach(([path, content]) => {
      // Ignorer certains fichiers de config non nécessaires pour Sandpack
      if (path.includes('vite.config') || path.includes('tsconfig')) {
        return;
      }
      
      // Normaliser le chemin: /src/App.tsx -> /App.tsx pour Sandpack
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;
      
      // Sandpack préfère les fichiers à la racine, pas dans /src
      if (normalizedPath.startsWith('/src/')) {
        normalizedPath = normalizedPath.replace('/src/', '/');
      }
      
      sandpackFiles[normalizedPath] = content;
    });
    
    // S'assurer qu'on a un index.tsx valide
    if (!sandpackFiles['/index.tsx'] && sandpackFiles['/main.tsx']) {
      sandpackFiles['/index.tsx'] = sandpackFiles['/main.tsx'];
      delete sandpackFiles['/main.tsx'];
    }
    
    // S'assurer qu'on a les styles
    if (!sandpackFiles['/styles.css'] && sandpackFiles['/index.css']) {
      sandpackFiles['/styles.css'] = sandpackFiles['/index.css'];
      // Mettre à jour l'import dans App.tsx si nécessaire
      if (sandpackFiles['/App.tsx']?.includes('./index.css')) {
        sandpackFiles['/App.tsx'] = sandpackFiles['/App.tsx'].replace('./index.css', './styles.css');
      }
    }
    
    console.log('📦 Sandpack files (React):', Object.keys(sandpackFiles));
    return sandpackFiles;
  }
  
  // Fallback: Projet HTML/CSS/JS vanilla - le convertir en React
  console.log('⚠️ Projet HTML/CSS/JS détecté - conversion en React');
  
  const htmlContent = files['index.html'] || files['/index.html'] || '';
  const cssContent = files['styles.css'] || files['/styles.css'] || files['style.css'] || files['/style.css'] || files['index.css'] || '';
  const jsContent = files['script.js'] || files['/script.js'] || '';
  
  // Extraire le body du HTML
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;
  
  // Nettoyer le contenu HTML pour JSX
  const cleanedBodyContent = bodyContent
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // Créer App.tsx avec le HTML converti
  sandpackFiles['/App.tsx'] = `import './styles.css';

export default function App() {
  return (
    <div className="app-container" dangerouslySetInnerHTML={{ __html: \`${cleanedBodyContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }} />
  );
}
`;

  // Créer index.tsx
  sandpackFiles['/index.tsx'] = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

  // Créer styles.css
  sandpackFiles['/styles.css'] = cssContent || `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
}

.app-container {
  min-height: 100vh;
}
`;

  console.log('📦 Sandpack files (converted HTML):', Object.keys(sandpackFiles));
  return sandpackFiles;
}

// Script d'inspection à injecter
const inspectorScript = `
// === MAGELLAN VISUAL INSPECTOR ===
(function() {
  if (window.__MAGELLAN_INSPECTOR_INJECTED__) return;
  window.__MAGELLAN_INSPECTOR_INJECTED__ = true;

  let inspectMode = false;
  let hoveredElement = null;
  let lastHoveredElement = null;
  const selectableTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'INPUT', 'IMG', 'SVG', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'UL', 'LI'];

  const getElementDescription = (tag) => {
    const tagLower = tag.toLowerCase();
    const labels = {
      h1: 'Titre H1', h2: 'Titre H2', h3: 'Titre H3',
      h4: 'Titre H4', h5: 'Titre H5', h6: 'Titre H6',
      button: 'Bouton', a: 'Lien', p: 'Paragraphe',
      img: 'Image', svg: 'Icône', div: 'Conteneur',
      section: 'Section', article: 'Article', header: 'Header',
      footer: 'Footer', nav: 'Navigation', ul: 'Liste',
      li: 'Élément de liste', span: 'Texte', input: 'Champ'
    };
    return labels[tagLower] || tagLower.toUpperCase();
  };

  const getElementPath = (element) => {
    const path = [];
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(' ').filter(c => c).join('.');
        if (classes) selector += '.' + classes;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  };

  const createHighlight = (element) => {
    const existing = document.querySelectorAll('[data-magellan-highlight]');
    existing.forEach(el => el.remove());

    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.setAttribute('data-magellan-highlight', 'true');
    highlight.style.cssText = \`
      position: fixed;
      left: \${rect.left}px;
      top: \${rect.top}px;
      width: \${rect.width}px;
      height: \${rect.height}px;
      outline: 2px solid #03A5C0;
      outline-offset: 2px;
      pointer-events: none;
      z-index: 999999;
      transition: all 0.1s ease;
    \`;

    const label = document.createElement('div');
    label.setAttribute('data-magellan-highlight', 'true');
    label.style.cssText = \`
      position: fixed;
      left: \${rect.left}px;
      top: \${rect.top - 26}px;
      background: #03A5C0;
      color: white;
      padding: 4px 8px;
      font-size: 11px;
      font-family: monospace;
      font-weight: 600;
      border-radius: 4px;
      pointer-events: none;
      z-index: 999999;
      white-space: nowrap;
    \`;
    label.textContent = getElementDescription(element.tagName);

    document.body.appendChild(highlight);
    document.body.appendChild(label);
  };

  const removeHighlight = () => {
    const highlights = document.querySelectorAll('[data-magellan-highlight]');
    highlights.forEach(h => h.remove());
  };

  // Écouter les messages du parent
  window.addEventListener('message', (e) => {
    if (e.data.type === 'toggle-inspect') {
      inspectMode = e.data.enabled;
      console.log('🔍 Inspect mode:', inspectMode);
      if (!inspectMode) {
        removeHighlight();
        hoveredElement = null;
        lastHoveredElement = null;
        document.body.style.cursor = '';
      } else {
        document.body.style.cursor = 'crosshair';
      }
    }
  });

  // Gérer le survol
  document.addEventListener('mousemove', (e) => {
    if (!inspectMode) return;
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) {
      removeHighlight();
      return;
    }

    if (!selectableTags.includes(target.tagName)) {
      removeHighlight();
      return;
    }

    if (target !== lastHoveredElement) {
      lastHoveredElement = target;
      createHighlight(target);
      hoveredElement = target;
    }
  }, true);

  // Gérer le clic
  document.addEventListener('click', (e) => {
    if (!inspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (!selectableTags.includes(target.tagName)) return;

    const rect = target.getBoundingClientRect();
    const elementInfo = {
      tagName: target.tagName,
      textContent: target.textContent?.substring(0, 200) || '',
      classList: Array.from(target.classList),
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

    console.log('✅ Élément sélectionné:', elementInfo);
    window.parent.postMessage({
      type: 'element-selected',
      data: elementInfo
    }, '*');
  }, true);

  // Signaler que l'inspector est prêt
  console.log('📡 Inspector ready');
  window.parent.postMessage({ type: 'inspect-ready' }, '*');
})();
`;

// Injecter le script d'inspection dans les fichiers
function injectInspector(files: Record<string, string>): Record<string, string> {
  const modifiedFiles = { ...files };
  
  // Trouver le fichier d'entrée
  const entryFile = Object.keys(files).find(f => 
    f === '/index.tsx' || f === '/main.tsx' || f === '/App.tsx'
  );
  
  if (entryFile && modifiedFiles[entryFile]) {
    // Injecter comme un effet React au début du fichier
    const injectCode = `
// Inspector injection
if (typeof window !== 'undefined') {
  ${inspectorScript}
}
`;
    modifiedFiles[entryFile] = injectCode + '\n' + modifiedFiles[entryFile];
  }
  
  return modifiedFiles;
}

function SandpackController({ 
  files, 
  inspectMode, 
  onInspectModeChange 
}: { 
  files: Record<string, string>;
  inspectMode?: boolean;
  onInspectModeChange?: (mode: boolean) => void;
}) {
  const { sandpack } = useSandpack();
  const previousFilesRef = useRef<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateType, setUpdateType] = useState<'css' | 'html' | 'full' | null>(null);

  // Écouter le message de reload depuis FakeUrlBar
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'reload') {
        console.log('🔄 SandpackController: Reloading sandbox...');
        setIsUpdating(true);
        setUpdateType('full');
        
        // Force refresh en réinitialisant tous les fichiers
        try {
          // Réinitialiser le sandbox en mettant à jour tous les fichiers
          Object.entries(files).forEach(([path, content]) => {
            sandpack.updateFile(path, content + ' '); // Petit trick pour forcer l'update
            sandpack.updateFile(path, content); // Remettre le contenu original
          });
          
          // Alternative: utiliser resetAllFiles si disponible
          if (typeof sandpack.resetAllFiles === 'function') {
            sandpack.resetAllFiles();
          }
        } catch (error) {
          console.error('Erreur reload:', error);
        }
        
        setTimeout(() => {
          setIsUpdating(false);
          setUpdateType(null);
        }, 500);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sandpack, files]);

  // Envoyer le mode inspection à l'iframe Sandpack
  useEffect(() => {
    const iframe = document.querySelector('iframe[title="Sandpack Preview"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'toggle-inspect', enabled: inspectMode }, '*');
    }
  }, [inspectMode]);

  useEffect(() => {
    const detectChanges = () => {
      const changes: Array<{ path: string; type: 'modified' | 'added' | 'deleted' }> = [];
      const previous = previousFilesRef.current;

      for (const [path, content] of Object.entries(files)) {
        if (!previous[path]) {
          changes.push({ path, type: 'added' });
        } else if (previous[path] !== content) {
          changes.push({ path, type: 'modified' });
        }
      }

      for (const path of Object.keys(previous)) {
        if (!files[path]) {
          changes.push({ path, type: 'deleted' });
        }
      }

      return changes;
    };

    const changes = detectChanges();

    if (changes.length > 0 && Object.keys(previousFilesRef.current).length > 0) {
      console.log('🔥 Sandpack Hot Reload:', changes.length, 'changements');

      const hasCSSOnly = changes.every(c => c.path.endsWith('.css') || c.path.endsWith('.scss'));
      const type: 'css' | 'full' = hasCSSOnly ? 'css' : 'full';
      setUpdateType(type);
      setIsUpdating(true);

      try {
        for (const change of changes) {
          if (change.type === 'modified' || change.type === 'added') {
            sandpack.updateFile(change.path, files[change.path] || '');
          } else if (change.type === 'deleted') {
            sandpack.deleteFile(change.path);
          }
        }
      } catch (error) {
        console.error('Erreur hot reload:', error);
      }

      setTimeout(() => {
        setIsUpdating(false);
        setUpdateType(null);
      }, 300);
    }

    previousFilesRef.current = { ...files };
  }, [files, sandpack]);

  return <HotReloadIndicator isUpdating={isUpdating} updateType={updateType} />;
}

export function SandpackHotReload({ 
  files, 
  isDark, 
  inspectMode = false, 
  onElementSelect 
}: SandpackHotReloadProps) {
  // Convertir les fichiers vers le format Sandpack
  const sandpackFiles = convertToSandpackFiles(files);
  
  // Injecter le script d'inspection
  const filesWithInspector = injectInspector(sandpackFiles);

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

  return (
    <SandpackProvider
      template="react-ts"
      files={filesWithInspector}
      theme={isDark ? 'dark' : 'light'}
      options={{
        autoReload: true,
        recompileMode: 'delayed',
        recompileDelay: 300,
        externalResources: [
          'https://cdn.tailwindcss.com'
        ]
      }}
      customSetup={{
        dependencies: {
          'react': '^18.3.1',
          'react-dom': '^18.3.1'
        }
      }}
    >
      <div className="h-full w-full relative flex flex-col">
        <SandpackController 
          files={filesWithInspector} 
          inspectMode={inspectMode}
        />
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          style={{ height: '100%', flex: 1 }}
        />
      </div>
    </SandpackProvider>
  );
}
