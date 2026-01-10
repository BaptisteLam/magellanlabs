import { useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewComponent,
  SandpackConsole,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { useThemeStore } from '@/stores/themeStore';
import { injectInspectorIntoFiles } from '@/lib/sandpackInspector';

interface SandpackPreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  showConsole?: boolean;
  enableInspector?: boolean;
  onIframeReady?: (iframe: HTMLIFrameElement | null) => void;
}

export interface SandpackPreviewHandle {
  getIframe: () => HTMLIFrameElement | null;
  sendMessage: (message: any) => void;
}

// Composant interne pour accéder au contexte Sandpack
const SandpackContent = forwardRef<
  SandpackPreviewHandle,
  { showConsole?: boolean; onIframeReady?: (iframe: HTMLIFrameElement | null) => void }
>(({ showConsole = false, onIframeReady }, ref) => {
  const { sandpack } = useSandpack();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // Trouver l'iframe Sandpack
  useEffect(() => {
    const findIframe = () => {
      if (containerRef.current) {
        const iframe = containerRef.current.querySelector('iframe');
        if (iframe && iframe !== iframeRef.current) {
          iframeRef.current = iframe;
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
    }
  }));
  
  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <SandpackPreviewComponent
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          style={{ height: '100%' }}
        />
      </div>
      {showConsole && (
        <div className="h-32 border-t border-border">
          <SandpackConsole />
        </div>
      )}
    </div>
  );
});

SandpackContent.displayName = 'SandpackContent';

export const SandpackPreview = forwardRef<SandpackPreviewHandle, SandpackPreviewProps>(({ 
  projectFiles, 
  previewMode = 'desktop',
  showConsole = false,
  enableInspector = false,
  onIframeReady
}, ref) => {
  const { isDark } = useThemeStore();

  // Convertir les fichiers au format Sandpack (préfixe /)
  const sandpackFiles = useMemo(() => {
    const files: Record<string, { code: string; active?: boolean }> = {};
    
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Ajouter le préfixe / si absent
      const sandpackPath = path.startsWith('/') ? path : `/${path}`;
      files[sandpackPath] = { code: content };
    });

    // S'assurer qu'on a un fichier d'entrée
    if (!files['/index.html'] && !files['/src/main.tsx'] && !files['/src/App.tsx']) {
      // Créer une structure React basique si aucun fichier d'entrée
      if (Object.keys(files).length === 0) {
        files['/src/App.tsx'] = {
          code: `export default function App() {
  return <div className="p-8">
    <h1 className="text-2xl font-bold">Nouveau projet</h1>
    <p>Commencez à éditer votre code...</p>
  </div>
}`,
          active: true
        };
      }
    }

    // Marquer le fichier actif
    if (files['/src/App.tsx']) {
      files['/src/App.tsx'].active = true;
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

  // Déterminer le template en fonction du contenu
  const template = useMemo(() => {
    if (projectFiles['index.html'] || projectFiles['/index.html']) {
      // Si on a un index.html avec du React, utiliser vite-react-ts
      const indexContent = projectFiles['index.html'] || projectFiles['/index.html'] || '';
      if (indexContent.includes('react') || indexContent.includes('React')) {
        return 'vite-react-ts';
      }
      return 'static';
    }
    return 'vite-react-ts';
  }, [projectFiles]);

  // Clé stable pour éviter les re-renders inutiles
  const sandpackKey = useMemo(() => {
    return `sandpack-${Object.keys(projectFiles).length}-${template}-${enableInspector}`;
  }, [Object.keys(projectFiles).length, template, enableInspector]);

  if (Object.keys(projectFiles).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground">
        <p>Aucun fichier à prévisualiser</p>
      </div>
    );
  }

  return (
    <div 
      className={`w-full h-full ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto border-x border-border' : ''}`}
    >
      <SandpackProvider
        key={sandpackKey}
        template={template as any}
        files={sandpackFiles}
        customSetup={{
          dependencies: template === 'vite-react-ts' ? dependencies : undefined,
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
          onIframeReady={onIframeReady}
        />
      </SandpackProvider>
    </div>
  );
});

SandpackPreview.displayName = 'SandpackPreview';

export default SandpackPreview;
