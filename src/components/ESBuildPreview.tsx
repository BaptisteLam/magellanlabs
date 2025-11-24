import { useEffect, useRef, useState, useMemo } from 'react';
import { GeneratingPreview } from './GeneratingPreview';

interface ESBuildPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  onConsoleLog?: (log: { level: 'log' | 'error' | 'warn'; message: string }) => void;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function ESBuildPreview({ projectFiles, isDark = false, onConsoleLog, inspectMode = false, onElementSelect }: ESBuildPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [isBuilding, setIsBuilding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buildIdRef = useRef(0);

  // Normaliser les fichiers
  const normalizedFiles = useMemo(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return {};
    }

    const files: Record<string, string> = {};
    
    Object.entries(projectFiles).forEach(([path, content]) => {
      let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
      const fileContent = typeof content === 'string' ? content : content.code;
      files[normalizedPath] = fileContent;
    });

    return files;
  }, [projectFiles]);

  // Détecter le point d'entrée
  const entryPoint = useMemo(() => {
    const fileKeys = Object.keys(normalizedFiles);
    
    const entries = [
      'src/main.tsx',
      'src/index.tsx',
      'src/App.tsx',
      'main.tsx',
      'index.tsx',
      'App.tsx',
    ];
    
    for (const entry of entries) {
      if (fileKeys.includes(entry)) {
        return entry;
      }
    }
    
    const firstTsx = fileKeys.find(key => key.endsWith('.tsx') || key.endsWith('.jsx'));
    return firstTsx || fileKeys[0] || 'src/main.tsx';
  }, [normalizedFiles]);

  // Initialiser le worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/esbuild.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { id, success, code, error: buildError } = event.data;
      
      if (id !== buildIdRef.current) {
        return; // Ignorer les anciennes builds
      }

      if (success && code) {
        injectCodeIntoIframe(code);
        setError(null);
      } else {
        setError(buildError || 'Build failed');
      }
      
      setIsBuilding(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Rebuild quand les fichiers changent
  useEffect(() => {
    if (!normalizedFiles || Object.keys(normalizedFiles).length === 0) {
      return;
    }

    setIsBuilding(true);
    setError(null);
    buildIdRef.current++;

    workerRef.current?.postMessage({
      id: buildIdRef.current,
      files: normalizedFiles,
      entryPoint,
    });
  }, [normalizedFiles, entryPoint]);

  // Injecter le code compilé dans l'iframe
  const injectCodeIntoIframe = (code: string) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const doc = iframe.contentWindow.document;
    
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: ${isDark ? '#1a1a1a' : '#ffffff'};
      color: ${isDark ? '#ffffff' : '#000000'};
    }
    #root {
      min-height: 100vh;
    }
  </style>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "lucide-react": "https://esm.sh/lucide-react@0.462.0"
    }
  }
  </script>
  <script>
    // Script d'inspection pour le mode édition visuelle
    let inspectMode = false;
    let currentHighlight = null;
    
    window.addEventListener('message', (e) => {
      if (e.data.type === 'toggle-inspect') {
        inspectMode = e.data.enabled;
        if (inspectMode) {
          activateInspection();
        } else {
          deactivateInspection();
        }
      }
    });
    
    function activateInspection() {
      document.body.style.cursor = 'crosshair';
      document.addEventListener('click', handleElementClick, true);
      document.addEventListener('mouseover', highlightElement, true);
      document.addEventListener('mouseout', removeHighlight, true);
    }
    
    function deactivateInspection() {
      document.body.style.cursor = '';
      document.removeEventListener('click', handleElementClick, true);
      document.removeEventListener('mouseover', highlightElement, true);
      document.removeEventListener('mouseout', removeHighlight, true);
      removeHighlight();
    }
    
    function highlightElement(e) {
      if (!inspectMode) return;
      e.stopPropagation();
      const target = e.target;
      if (target === document.body || target === document.documentElement) return;
      
      removeHighlight();
      
      const rect = target.getBoundingClientRect();
      currentHighlight = document.createElement('div');
      currentHighlight.style.cssText = \`
        position: fixed;
        pointer-events: none;
        border: 2px solid rgb(3, 165, 192);
        background: rgba(3, 165, 192, 0.1);
        z-index: 999999;
        left: \${rect.left}px;
        top: \${rect.top}px;
        width: \${rect.width}px;
        height: \${rect.height}px;
      \`;
      document.body.appendChild(currentHighlight);
    }
    
    function removeHighlight() {
      if (currentHighlight) {
        currentHighlight.remove();
        currentHighlight = null;
      }
    }
    
    function handleElementClick(e) {
      if (!inspectMode) return;
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target;
      if (target === document.body || target === document.documentElement) return;
      
      const rect = target.getBoundingClientRect();
      const elementInfo = {
        tagName: target.tagName,
        textContent: target.textContent || '',
        classList: Array.from(target.classList || []),
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
      
      window.parent.postMessage({
        type: 'element-selected',
        data: elementInfo
      }, '*');
    }
    
    function getElementPath(element) {
      const path = [];
      let current = element;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector += '#' + current.id;
        } else if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\\s+/);
          if (classes.length > 0 && classes[0]) {
            selector += '.' + classes.join('.');
          }
        }
        path.unshift(selector);
        current = current.parentElement;
      }
      return path.join(' > ');
    }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    // Intercepter les console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      window.parent.postMessage({ 
        type: 'console', 
        level: 'log', 
        message: args.map(a => String(a)).join(' ') 
      }, '*');
    };

    console.error = (...args) => {
      originalError(...args);
      window.parent.postMessage({ 
        type: 'console', 
        level: 'error', 
        message: args.map(a => String(a)).join(' ') 
      }, '*');
    };

    console.warn = (...args) => {
      originalWarn(...args);
      window.parent.postMessage({ 
        type: 'console', 
        level: 'warn', 
        message: args.map(a => String(a)).join(' ') 
      }, '*');
    };

    // Intercepter les erreurs
    window.addEventListener('error', (event) => {
      window.parent.postMessage({
        type: 'console',
        level: 'error',
        message: event.error?.message || event.message || 'Unknown error'
      }, '*');
    });

    // Charger et exécuter le code
    try {
      import('react').then(React => {
        import('react-dom/client').then(ReactDOM => {
          // Code compilé
          const module = { exports: {} };
          ${code}
          
          // Chercher le composant par défaut
          const App = module.exports.default || module.exports;
          
          if (typeof App === 'function') {
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(App));
          } else {
            console.error('No default export found');
          }
        });
      });
    } catch (err) {
      console.error('Runtime error:', err);
    }
  </script>
</body>
</html>
    `.trim();

    doc.open();
    doc.write(html);
    doc.close();
  };

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'console' && onConsoleLog) {
        onConsoleLog({
          level: event.data.level,
          message: event.data.message,
        });
      }
      if (event.data?.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConsoleLog, onElementSelect]);

  // Envoyer l'état du mode inspection à l'iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      const sendInspectMode = () => {
        iframe.contentWindow?.postMessage({
          type: 'toggle-inspect',
          enabled: inspectMode
        }, '*');
      };
      
      // Envoyer immédiatement et après un court délai pour s'assurer que l'iframe est prête
      sendInspectMode();
      const timer = setTimeout(sendInspectMode, 100);
      
      return () => clearTimeout(timer);
    }
  }, [inspectMode, isBuilding]);

  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-destructive/10 border border-destructive rounded-lg p-6">
          <h3 className="text-lg font-semibold text-destructive mb-2">Build Error</h3>
          <pre className="text-sm text-destructive/90 whitespace-pre-wrap font-mono">
            {error}
          </pre>
        </div>
      </div>
    );
  }

  if (isBuilding) {
    return <GeneratingPreview />;
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        title="Preview"
      />
    </div>
  );
}
