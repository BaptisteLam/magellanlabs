import { useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewComponent,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { useThemeStore } from '@/stores/themeStore';
import { injectInspectorIntoFiles } from '@/lib/sandpackInspector';
import { Loader } from 'lucide-react';

interface SandpackPreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  showConsole?: boolean;
  enableInspector?: boolean;
  onIframeReady?: (iframe: HTMLIFrameElement | null) => void;
  onInspectorMessage?: (message: any) => void;
}

export interface SandpackPreviewHandle {
  getIframe: () => HTMLIFrameElement | null;
  sendMessage: (message: any) => void;
  setInspectMode: (enabled: boolean) => void;
}

// Détecter les imports manquants et créer des stubs
function createMissingComponentStubs(files: Record<string, { code: string; active?: boolean }>) {
  const imports: Map<string, string[]> = new Map();
  
  // Scanner tous les fichiers pour les imports
  Object.entries(files).forEach(([filePath, { code }]) => {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx') && !filePath.endsWith('.ts') && !filePath.endsWith('.js')) return;
    
    // Regex pour détecter les imports de composants locaux
    const importRegex = /import\s+(?:(\w+)|{\s*([^}]+)\s*})\s+from\s+['"](\.[^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      const defaultImport = match[1];
      const namedImports = match[2];
      const importPath = match[3];
      
      // Résoudre le chemin relatif
      const basePath = filePath.split('/').slice(0, -1).join('/');
      let resolvedPath = importPath;
      
      if (importPath.startsWith('./')) {
        resolvedPath = `${basePath}/${importPath.slice(2)}`;
      } else if (importPath.startsWith('../')) {
        const parts = basePath.split('/');
        parts.pop();
        resolvedPath = `${parts.join('/')}/${importPath.slice(3)}`;
      }
      
      // Ajouter extension si manquante
      if (!resolvedPath.match(/\.(tsx?|jsx?|css)$/)) {
        resolvedPath += '.tsx';
      }
      
      // Normaliser le chemin
      if (!resolvedPath.startsWith('/')) {
        resolvedPath = '/' + resolvedPath;
      }
      
      // Collecter les exports nécessaires
      const exports: string[] = [];
      if (defaultImport) exports.push(`default:${defaultImport}`);
      if (namedImports) {
        namedImports.split(',').forEach(imp => {
          const name = imp.trim().split(' as ')[0].trim();
          if (name) exports.push(name);
        });
      }
      
      if (!imports.has(resolvedPath)) {
        imports.set(resolvedPath, []);
      }
      imports.get(resolvedPath)!.push(...exports);
    }
  });
  
  // Créer les stubs pour les fichiers manquants
  imports.forEach((exports, path) => {
    // Vérifier si le fichier existe déjà
    const exists = files[path] || files[path.replace('.tsx', '.ts')] || files[path.replace('.tsx', '.jsx')] || files[path.replace('.tsx', '.js')];
    if (exists) return;
    
    // Ignorer les fichiers CSS
    if (path.endsWith('.css')) {
      files[path] = { code: '/* Auto-generated stub */' };
      return;
    }
    
    // Créer un composant stub
    const componentName = path.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') || 'Component';
    const hasDefaultExport = exports.some(e => e.startsWith('default:'));
    const namedExports = exports.filter(e => !e.startsWith('default:'));
    
    let stubCode = `// Auto-generated stub for missing component\n`;
    stubCode += `import React from 'react';\n\n`;
    
    // Export par défaut
    if (hasDefaultExport) {
      stubCode += `const ${componentName} = () => {\n`;
      stubCode += `  return (\n`;
      stubCode += `    <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">\n`;
      stubCode += `      <p className="text-gray-500 text-sm text-center">${componentName}</p>\n`;
      stubCode += `    </div>\n`;
      stubCode += `  );\n`;
      stubCode += `};\n\n`;
      stubCode += `export default ${componentName};\n`;
    }
    
    // Exports nommés
    namedExports.forEach(exportName => {
      if (exportName.match(/^[A-Z]/)) {
        // C'est probablement un composant
        stubCode += `\nexport const ${exportName} = () => {\n`;
        stubCode += `  return <div className="p-2 text-gray-500">${exportName}</div>;\n`;
        stubCode += `};\n`;
      } else {
        // C'est probablement une fonction ou une constante
        stubCode += `\nexport const ${exportName} = () => {};\n`;
      }
    });
    
    files[path] = { code: stubCode };
  });
  
  return files;
}

// Composant interne pour accéder au contexte Sandpack
const SandpackContent = forwardRef<
  SandpackPreviewHandle,
  { 
    showConsole?: boolean; 
    enableInspector?: boolean;
    onIframeReady?: (iframe: HTMLIFrameElement | null) => void;
    onInspectorMessage?: (message: any) => void;
  }
>(({ showConsole = false, enableInspector = false, onIframeReady, onInspectorMessage }, ref) => {
  const { sandpack } = useSandpack();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const inspectorReadyRef = useRef(false);
  
  // Envoyer le mode inspection à l'iframe
  const setInspectMode = useCallback((enabled: boolean) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: enabled ? 'inspect-mode-on' : 'inspect-mode-off'
      }, '*');
    }
  }, []);
  
  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type?.startsWith('inspect-')) {
        onInspectorMessage?.(event.data);
        
        if (event.data.type === 'inspector-loaded' || event.data.type === 'inspector-ready') {
          inspectorReadyRef.current = true;
          if (enableInspector) {
            setInspectMode(true);
          }
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enableInspector, onInspectorMessage, setInspectMode]);
  
  // Activer/désactiver le mode inspection quand la prop change
  useEffect(() => {
    if (inspectorReadyRef.current) {
      setInspectMode(enableInspector);
    }
  }, [enableInspector, setInspectMode]);
  
  // Trouver l'iframe Sandpack et la configurer
  useEffect(() => {
    const findIframe = () => {
      if (containerRef.current) {
        const iframe = containerRef.current.querySelector('iframe');
        if (iframe && iframe !== iframeRef.current) {
          iframeRef.current = iframe;
          // Forcer le style pour prendre toute la place
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          onIframeReady?.(iframe);
        }
      }
    };
    
    findIframe();
    const observer = new MutationObserver(findIframe);
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }
    
    return () => observer.disconnect();
  }, [onIframeReady]);
  
  useImperativeHandle(ref, () => ({
    getIframe: () => iframeRef.current,
    sendMessage: (message: any) => {
      iframeRef.current?.contentWindow?.postMessage(message, '*');
    },
    setInspectMode
  }));
  
  return (
    <div ref={containerRef} className="w-full h-full sandpack-white-label">
      <SandpackPreviewComponent
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        showNavigator={false}
        showRestartButton={false}
        showSandpackErrorOverlay={false}
        style={{ 
          height: '100%', 
          width: '100%',
          border: 'none',
          background: 'transparent'
        }}
      />
    </div>
  );
});

SandpackContent.displayName = 'SandpackContent';

export const SandpackPreview = forwardRef<SandpackPreviewHandle, SandpackPreviewProps>(({ 
  projectFiles, 
  previewMode = 'desktop',
  showConsole = false,
  enableInspector = false,
  onIframeReady,
  onInspectorMessage
}, ref) => {
  const { isDark } = useThemeStore();

  // Convertir les fichiers au format Sandpack (préfixe /)
  const sandpackFiles = useMemo(() => {
    let files: Record<string, { code: string; active?: boolean }> = {};
    
    // Fichiers à ignorer (config Vite, etc.)
    const skipFiles = [
      'package.json', 'package-lock.json', 'bun.lockb',
      'vite.config.ts', 'vite.config.js',
      'tsconfig.json', 'tsconfig.node.json', 'tsconfig.app.json',
      'postcss.config.js', 'tailwind.config.ts', 'tailwind.config.js',
      '.gitignore', 'README.md', '.env', '.env.local',
      'eslint.config.js', 'components.json'
    ];
    
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Ignorer les fichiers de config
      const fileName = path.split('/').pop() || '';
      if (skipFiles.includes(fileName)) return;
      
      // Ignorer les dossiers de config
      if (path.includes('node_modules/') || path.includes('.git/')) return;
      
      // Normaliser le chemin - ajouter /src/ si nécessaire
      let sandpackPath = path.startsWith('/') ? path : `/${path}`;
      
      // Si le fichier est à la racine et est un .tsx/.ts/.jsx/.js, le mettre dans /src/
      if (!sandpackPath.includes('/src/') && /^\/(App|main|index)\.(tsx|ts|jsx|js)$/.test(sandpackPath)) {
        sandpackPath = `/src${sandpackPath}`;
      }
      
      files[sandpackPath] = { code: content };
    });

    // Vérifier si on a App.tsx (avec ou sans préfixe src/)
    const hasAppTsx = files['/src/App.tsx'] || files['/App.tsx'];
    const hasMainTsx = files['/src/main.tsx'] || files['/main.tsx'];

    // Créer une structure React basique si les fichiers d'entrée sont manquants
    if (!hasAppTsx && Object.keys(files).length === 0) {
      files['/src/App.tsx'] = {
        code: `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Nouveau projet</h1>
        <p className="text-gray-600">Commencez à éditer votre code...</p>
      </div>
    </div>
  );
}`,
        active: true
      };
    }

    // Si on a App.tsx mais pas main.tsx, le créer
    if ((files['/src/App.tsx'] || files['/App.tsx']) && !hasMainTsx) {
      const appPath = files['/src/App.tsx'] ? './App' : '../App';
      files['/src/main.tsx'] = {
        code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${appPath}';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
      };
    }

    // S'assurer qu'on a un fichier CSS de base
    if (!files['/src/index.css'] && !files['/index.css']) {
      files['/src/index.css'] = {
        code: `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
}`
      };
    }

    // Créer des stubs pour les composants manquants
    files = createMissingComponentStubs(files);

    // Marquer le fichier actif
    if (files['/src/App.tsx']) {
      files['/src/App.tsx'].active = true;
    } else if (files['/App.tsx']) {
      files['/App.tsx'].active = true;
    } else if (files['/index.html']) {
      files['/index.html'].active = true;
    }

    // Injecter le script d'inspection si activé
    return injectInspectorIntoFiles(files, enableInspector);
  }, [projectFiles, enableInspector]);

  // Dépendances courantes pour les projets React
  const dependencies = useMemo(() => ({
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.462.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "framer-motion": "^12.0.0",
  }), []);

  // Clé stable pour éviter les re-renders inutiles
  const sandpackKey = useMemo(() => {
    const fileCount = Object.keys(sandpackFiles).length;
    const filesHash = Object.keys(sandpackFiles).sort().join(',').substring(0, 100);
    return `sandpack-${fileCount}-${enableInspector}-${filesHash}`;
  }, [sandpackFiles, enableInspector]);

  // ✅ FIX: Afficher un loader au lieu de "Hello World" quand les fichiers sont vides
  // Vérifier si on a au moins un fichier React valide (App.tsx ou main.tsx)
  const hasValidReactFiles = useMemo(() => {
    const keys = Object.keys(projectFiles);
    return keys.some(k => 
      k.includes('App.tsx') || 
      k.includes('App.jsx') || 
      k.includes('main.tsx') ||
      k.includes('index.tsx')
    );
  }, [projectFiles]);

  if (Object.keys(projectFiles).length === 0 || !hasValidReactFiles) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 mx-auto mb-4 text-[#03A5C0]" />
          <p className="text-muted-foreground">Chargement du projet...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-full h-full sandpack-container ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto border-x border-border' : ''}`}
    >
      <SandpackProvider
        key={sandpackKey}
        template="vite-react-ts"
        files={sandpackFiles}
        customSetup={{
          dependencies,
        }}
        theme={isDark ? 'dark' : 'light'}
        options={{
          recompileMode: 'delayed',
          recompileDelay: 300,
          autorun: true,
          autoReload: true,
        }}
      >
        <SandpackContent 
          ref={ref}
          showConsole={showConsole}
          enableInspector={enableInspector}
          onIframeReady={onIframeReady}
          onInspectorMessage={onInspectorMessage}
        />
      </SandpackProvider>
    </div>
  );
});

SandpackPreview.displayName = 'SandpackPreview';

export default SandpackPreview;
