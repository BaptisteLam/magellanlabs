import { useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewComponent,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { useThemeStore } from '@/stores/themeStore';
import { RefreshCw, FileWarning } from 'lucide-react';

// 🔧 Composant de fallback visuel pour les erreurs
interface ErrorFallbackProps {
  message: string;
  onRetry?: () => void;
}

function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-800 overflow-hidden">
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
            <FileWarning className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-300">Erreur de prévisualisation</h3>
            <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
          </div>
        </div>
        {onRetry && (
          <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A5C0] text-white rounded-full hover:bg-[#028a9e] transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// CSS de base complet pour les projets statiques générés
const BASE_CSS = `:root {
  --primary: #03A5C0;
  --primary-dark: #028a9e;
  --primary-light: rgba(3, 165, 192, 0.1);
  --secondary: #1a1a2e;
  --text: #1f2937;
  --text-light: #6b7280;
  --background: #ffffff;
  --background-alt: #f9fafb;
  --border: #e5e7eb;
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.1);
  --radius: 0.5rem;
  --transition: all 0.3s ease;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background: var(--background);
  -webkit-font-smoothing: antialiased;
}

img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; transition: color 0.2s; }
button { cursor: pointer; font-family: inherit; border: none; background: none; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.section { padding: 5rem 0; }

.nav-link {
  color: var(--text-light);
  transition: var(--transition);
}
.nav-link:hover { color: var(--primary); }

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2rem;
  background: var(--primary);
  color: white;
  font-weight: 500;
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  transition: var(--transition);
}
.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: var(--transition);
}
.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fadeInUp 0.6s ease forwards; }

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in { animation: fadeIn 0.6s ease forwards; }

.toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 1rem 1.5rem;
  border-radius: var(--radius);
  font-weight: 500;
  z-index: 1000;
}
.toast-success { background: #10b981; color: white; }
.toast-error { background: #ef4444; color: white; }
`;

// JS de base pour fallback
const BASE_JS = `document.addEventListener('DOMContentLoaded', function() {
  console.log('Site loaded');
  
  // Mobile menu
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
  }
  
  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
`;

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
        showSandpackErrorOverlay={true}
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

  // 🔧 Convertir les fichiers au format Sandpack pour STATIC uniquement
  const sandpackFiles = useMemo(() => {
    let files: Record<string, { code: string; active?: boolean }> = {};
    
    console.log('🔍 [SandpackPreview] Received files:', {
      count: Object.keys(projectFiles).length,
      paths: Object.keys(projectFiles),
    });

    // Si aucun fichier, créer un fallback
    if (Object.keys(projectFiles).length === 0) {
      console.warn('⚠️ [SandpackPreview] No project files - creating fallback');
      return {
        '/index.html': {
          code: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site en construction</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
  <div class="text-center p-8">
    <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-[#03A5C0]/10 flex items-center justify-center">
      <svg class="w-8 h-8 text-[#03A5C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    </div>
    <h1 class="text-2xl font-bold text-gray-800 mb-3">Génération en cours...</h1>
    <p class="text-gray-600">Votre site sera bientôt prêt.</p>
  </div>
</body>
</html>`,
          active: true
        },
        '/styles.css': { code: BASE_CSS }
      };
    }
    
    // Fichiers à ignorer
    const skipFiles = ['package.json', 'package-lock.json', 'node_modules', '.git'];
    
    Object.entries(projectFiles).forEach(([path, content]) => {
      const fileName = path.split('/').pop() || '';
      if (skipFiles.some(skip => path.includes(skip))) return;
      
      // Normaliser le chemin pour Sandpack static
      let sandpackPath = path.startsWith('/') ? path : '/' + path;
      
      // Nettoyer le contenu
      let cleanContent = content;
      if (typeof cleanContent === 'string') {
        cleanContent = cleanContent.trim();
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
        }
      }
      
      files[sandpackPath] = { code: cleanContent };
    });
    
    // S'assurer que index.html existe et est marqué comme actif
    if (files['/index.html']) {
      files['/index.html'].active = true;
    } else {
      // Créer un index.html de fallback
      console.warn('⚠️ [SandpackPreview] No index.html found - creating fallback');
      files['/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app">
    <h1>Contenu en cours de génération...</h1>
  </div>
  <script src="/app.js"></script>
</body>
</html>`,
        active: true
      };
    }
    
    // S'assurer qu'on a un styles.css
    if (!files['/styles.css']) {
      console.log('📝 [SandpackPreview] Adding fallback styles.css');
      files['/styles.css'] = { code: BASE_CSS };
    }
    
    // S'assurer qu'on a un app.js
    if (!files['/app.js']) {
      console.log('📝 [SandpackPreview] Adding fallback app.js');
      files['/app.js'] = { code: BASE_JS };
    }
    
    console.log('✅ [SandpackPreview] Final static files:', Object.keys(files).join(', '));
    
    return files;
  }, [projectFiles]);

  // Clé stable basée sur le contenu réel
  const sandpackKey = useMemo(() => {
    const fileCount = Object.keys(sandpackFiles).length;
    const contentHash = Object.values(sandpackFiles)
      .map(f => f.code.length)
      .reduce((a, b) => a + b, 0);
    return `sandpack-static-${fileCount}-${contentHash}`;
  }, [sandpackFiles]);
  
  console.log('🚀 [SandpackPreview] Rendering static Sandpack with:', {
    fileCount: Object.keys(sandpackFiles).length,
    files: Object.keys(sandpackFiles),
  });

  // Collecter les fichiers visibles
  const visibleFiles = Object.keys(sandpackFiles).filter(f => 
    f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.js')
  );
  
  return (
    <div className={`w-full h-full sandpack-container ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto border-x border-border' : ''}`}>
      <SandpackProvider
        key={sandpackKey}
        template="static"
        files={sandpackFiles}
        theme={isDark ? 'dark' : 'light'}
        options={{
          recompileMode: 'delayed',
          recompileDelay: 50,
          autorun: true,
          autoReload: true,
          activeFile: '/index.html',
          visibleFiles: visibleFiles,
          initMode: 'immediate',
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
