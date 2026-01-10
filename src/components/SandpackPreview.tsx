import { useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewComponent,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { useThemeStore } from '@/stores/themeStore';
import { injectInspectorIntoFiles } from '@/lib/sandpackInspector';

// 🔧 Liste exhaustive des icônes lucide-react pour corrections JSX
const LUCIDE_ICONS = [
  'Mail', 'Phone', 'MapPin', 'Star', 'Hotel', 'Palmtree', 'Check', 'X', 'Menu',
  'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ChevronDown', 'ChevronUp',
  'ChevronRight', 'ChevronLeft', 'Home', 'User', 'Settings', 'Search', 'Heart',
  'Clock', 'Calendar', 'Send', 'Loader', 'Loader2', 'AlertCircle', 'Info',
  'CheckCircle', 'XCircle', 'Plus', 'Minus', 'Edit', 'Trash', 'Trash2',
  'Download', 'Upload', 'Share', 'Link', 'ExternalLink', 'Copy', 'Eye', 'EyeOff',
  'Lock', 'Unlock', 'Key', 'Bell', 'BellOff', 'Bookmark', 'Flag', 'Filter',
  'Grid', 'List', 'MoreHorizontal', 'MoreVertical', 'RefreshCw', 'RotateCw',
  'Save', 'Scissors', 'Shield', 'Shuffle', 'Sidebar', 'Skip', 'Sliders',
  'Smartphone', 'Speaker', 'Square', 'Sun', 'Moon', 'Sunrise', 'Sunset',
  'Table', 'Tag', 'Target', 'Terminal', 'ThumbsUp', 'ThumbsDown',
  'TrendingUp', 'TrendingDown', 'Triangle', 'Tv', 'Twitter', 'Type',
  'Umbrella', 'Underline', 'Undo', 'UploadCloud', 'UserCheck', 'UserMinus',
  'UserPlus', 'Users', 'Video', 'VideoOff', 'Voicemail', 'Volume', 'Volume1',
  'Volume2', 'VolumeX', 'Watch', 'Wifi', 'WifiOff', 'Wind', 'Zap', 'ZoomIn',
  'ZoomOut', 'Facebook', 'Instagram', 'Linkedin', 'Youtube', 'Github', 'Globe',
  'Award', 'Briefcase', 'Building', 'Car', 'Coffee', 'Compass', 'CreditCard',
  'DollarSign', 'Euro', 'Gift', 'Headphones', 'Image', 'Layers', 'Layout',
  'LifeBuoy', 'Map', 'MessageCircle', 'MessageSquare', 'Mic', 'MicOff',
  'Monitor', 'Package', 'PaperClip', 'Pause', 'Percent', 'PhoneCall',
  'PhoneForwarded', 'PhoneIncoming', 'PhoneMissed', 'PhoneOff', 'PhoneOutgoing',
  'PieChart', 'Play', 'PlayCircle', 'PlusCircle', 'Pocket', 'Power', 'Printer',
  'Radio', 'Repeat', 'Rewind', 'ShoppingBag', 'ShoppingCart', 'Sparkles', 'Waves',
  'Utensils', 'Bed', 'Bath', 'Wifi', 'Parking', 'AirVent', 'Dumbbell', 'Pool',
  'Plane', 'Train', 'Bus', 'Bicycle', 'Ship', 'Mountain', 'Trees', 'Flower',
  'Leaf', 'Droplet', 'Flame', 'Snowflake', 'Cloud', 'CloudRain', 'CloudSnow'
].join('|');

// 🔧 PHASE 4: Fonction AMÉLIORÉE pour corriger les erreurs JSX courantes
function fixJSXSyntaxErrors(code: string, filePath: string): string {
  if (!filePath.match(/\.(tsx|jsx)$/)) return code;
  
  let fixed = code;
  const original = code;
  
  // 0. Nettoyer les retours à la ligne Windows
  fixed = fixed.replace(/\r\n/g, '\n');
  
  // 1. Pattern AGRESSIF: icône suivie de newline puis attribut (cas <Mail\n  className)
  const iconNewlinePattern = new RegExp(
    `<(${LUCIDE_ICONS})\\s*\\n\\s*(className|size|strokeWidth|color|onClick|aria-label|style)`,
    'g'
  );
  fixed = fixed.replace(iconNewlinePattern, '<$1 $2');
  
  // 2. Icônes avec attributs mais terminées par > au lieu de />
  const iconWithAttrsNoClose = new RegExp(
    `<(${LUCIDE_ICONS})(\\s+[^>]*[^/])>(?!\\s*</)`,
    'g'
  );
  fixed = fixed.replace(iconWithAttrsNoClose, '<$1$2 />');
  
  // 3. Icônes vides non auto-fermées: <Icon> -> <Icon />
  const iconEmptyNoClose = new RegExp(`<(${LUCIDE_ICONS})>`, 'g');
  fixed = fixed.replace(iconEmptyNoClose, '<$1 />');
  
  // 4. Supprimer les balises fermantes des icônes: </Icon> -> (rien)
  const iconClosingTag = new RegExp(`</(${LUCIDE_ICONS})>`, 'g');
  fixed = fixed.replace(iconClosingTag, '');
  
  // 5. Corriger les doubles />
  fixed = fixed.replace(/\s*\/>\s*\/>/g, ' />');
  
  // 6. Corriger className coupé en milieu de ligne
  fixed = fixed.replace(/className="\s*\n\s*/g, 'className="');
  
  // 7. Corriger les attributs coupés: size={\n  24} -> size={24}
  fixed = fixed.replace(/(size|strokeWidth|width|height)=\{\s*\n\s*(\d+)\s*\}/g, '$1={$2}');
  
  // 8. Corriger les icônes tronquées: <Mail (sans suite) -> <Mail />
  const truncatedIcon = new RegExp(`<(${LUCIDE_ICONS})\\s*$`, 'gm');
  fixed = fixed.replace(truncatedIcon, '<$1 />');
  
  // 9. Corriger les icônes avec seulement des espaces: <Mail   > -> <Mail />
  const iconOnlySpaces = new RegExp(`<(${LUCIDE_ICONS})\\s+>`, 'g');
  fixed = fixed.replace(iconOnlySpaces, '<$1 />');
  
  // 10. NOUVEAU: Corriger les balises HTML self-closing oubliées (img, br, hr, input, etc.)
  const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  selfClosingTags.forEach(tag => {
    // Pattern: <img src="..." > → <img src="..." />
    const pattern = new RegExp(`<${tag}(\\s+[^>]*[^/])>`, 'gi');
    fixed = fixed.replace(pattern, `<${tag}$1 />`);
    // Pattern: <img> → <img />
    const emptyPattern = new RegExp(`<${tag}>`, 'gi');
    fixed = fixed.replace(emptyPattern, `<${tag} />`);
  });
  
  // 11. NOUVEAU: Corriger les fragments mal formés
  fixed = fixed.replace(/<>(\s*\n\s*)+$/gm, '<></>');
  fixed = fixed.replace(/<\/>\s*<\/>/g, '</>');
  
  // 12. NOUVEAU: Corriger les accolades JSX non fermées dans les attributs simples
  fixed = fixed.replace(/=\{([^{}]*[^}])\n(\s*[a-zA-Z]+=)/g, '={$1}\n$2');
  
  // 13. NOUVEAU: Supprimer les imports dupliqués de React (cause d'erreur)
  const importLines = fixed.split('\n');
  const seenImports = new Set<string>();
  const cleanedLines = importLines.filter(line => {
    const importMatch = line.match(/^import\s+.*\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const key = importMatch[0];
      if (seenImports.has(key)) {
        return false; // Supprimer l'import dupliqué
      }
      seenImports.add(key);
    }
    return true;
  });
  fixed = cleanedLines.join('\n');
  
  // Log si des corrections ont été faites
  if (fixed !== original) {
    console.log(`🔧 [fixJSXSyntaxErrors] Fixed JSX syntax in ${filePath}`);
  }
  
  return fixed;
}

// 🔧 PHASE 3: Normalisation INTELLIGENTE des chemins avec aliases
function normalizeFilePath(path: string): string {
  let normalized = path.startsWith('/') ? path : '/' + path;
  
  // Aliases courants pour mapper vers la structure /src/
  const aliases: Record<string, string> = {
    '/App.tsx': '/src/App.tsx',
    '/App.jsx': '/src/App.jsx',
    '/app.tsx': '/src/App.tsx',
    '/app.jsx': '/src/App.jsx',
    '/main.tsx': '/src/main.tsx',
    '/index.tsx': '/src/main.tsx', // Alias index → main
    '/index.jsx': '/src/main.jsx',
    '/index.css': '/src/index.css',
    '/styles.css': '/src/index.css',
    '/style.css': '/src/index.css',
  };
  
  // Appliquer l'alias si existe
  if (aliases[normalized]) {
    console.log(`📁 [normalizeFilePath] Alias applied: ${normalized} → ${aliases[normalized]}`);
    return aliases[normalized];
  }
  
  // Forcer les fichiers source dans /src/ sauf exceptions
  if (normalized.match(/\.(tsx|jsx|ts|js|css)$/) && !normalized.startsWith('/src/') && !normalized.startsWith('/public/')) {
    const cleanPath = normalized.replace(/^\/+/, '');
    // Si déjà préfixé src/, ne pas doubler
    if (!cleanPath.startsWith('src/')) {
      const newPath = '/src/' + cleanPath;
      console.log(`📁 [normalizeFilePath] Forced to /src/: ${normalized} → ${newPath}`);
      return newPath;
    }
  }
  
  return normalized;
}

// 🔧 PHASE 1: Détecter si c'est un projet HTML pur et le convertir en React
function detectAndConvertHTMLProject(files: Record<string, string>): Record<string, string> {
  const hasReactFiles = Object.keys(files).some(k => 
    k.match(/\.(tsx|jsx)$/) && !k.includes('node_modules')
  );
  
  // Si on a déjà des fichiers React, ne pas convertir
  if (hasReactFiles) {
    console.log('🔍 [detectAndConvertHTMLProject] React files found, skipping conversion');
    return files;
  }
  
  // Chercher un index.html
  const htmlFile = Object.entries(files).find(([k]) => 
    k.endsWith('.html') || k.endsWith('.htm')
  );
  
  // Chercher un fichier CSS
  const cssFile = Object.entries(files).find(([k]) => k.endsWith('.css'));
  
  if (htmlFile) {
    const [htmlPath, htmlContent] = htmlFile;
    console.log(`🔄 [detectAndConvertHTMLProject] Converting HTML project from ${htmlPath}`);
    
    // Extraire le body du HTML
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1].trim() : htmlContent;
    
    // Échapper les backticks pour le template literal
    const escapedBody = bodyContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    // Créer un projet React à partir du HTML
    const convertedFiles = {
      ...files,
      '/src/App.tsx': `import React from 'react';
import './index.css';

export default function App() {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${escapedBody}\` }} />
  );
}`,
      '/src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
      '/src/index.css': cssFile ? cssFile[1] : '/* Converted from HTML project */'
    };
    
    console.log('✅ [detectAndConvertHTMLProject] HTML project converted to React');
    return convertedFiles;
  }
  
  return files;
}

// 🔧 PHASE 2: Créer un fallback React si aucun fichier valide n'est trouvé
function createFallbackReactProject(existingFiles: Record<string, { code: string; active?: boolean }>): Record<string, { code: string; active?: boolean }> {
  // Lister les fichiers existants pour debug
  const existingPaths = Object.keys(existingFiles).join(', ');
  console.log(`🔧 [createFallbackReactProject] Creating fallback from existing files: ${existingPaths}`);
  
  // Créer un App.tsx de fallback
  const fallbackApp = `import React from 'react';
import './index.css';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#03A5C0]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#03A5C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">Génération en cours...</h1>
        <p className="text-gray-600 mb-4">Votre site est en train d'être créé.</p>
        <p className="text-sm text-gray-500">Le contenu apparaîtra dès qu'il sera prêt.</p>
      </div>
    </div>
  );
}`;

  const fallbackMain = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

  return {
    ...existingFiles,
    '/src/App.tsx': { code: fallbackApp, active: true },
    '/src/main.tsx': { code: fallbackMain },
  };
}

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
    console.log(`📦 [createMissingComponentStubs] Created stub for ${path}`);
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

// CSS de base complet pour les projets générés
const BASE_CSS = `/* Reset et styles de base */
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { 
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #1a1a2e;
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; transition: color 0.2s; }
button { cursor: pointer; font-family: inherit; border: none; }
input, textarea { font-family: inherit; }

/* Variables CSS */
:root {
  --primary: #03A5C0;
  --primary-dark: #028a9e;
  --secondary: #1a1a2e;
  --accent: #03A5C0;
  --white: #ffffff;
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 25px -5px rgba(0,0,0,0.15);
  --radius: 0.5rem;
}

/* Classes utilitaires essentielles */
.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.section { padding: 4rem 0; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

/* Flexbox */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

/* Grid */
.grid { display: grid; }
.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

/* Spacing */
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }
.gap-8 { gap: 2rem; }
.p-2 { padding: 0.5rem; }
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.py-4 { padding-top: 1rem; padding-bottom: 1rem; }
.py-8 { padding-top: 2rem; padding-bottom: 2rem; }
.py-16 { padding-top: 4rem; padding-bottom: 4rem; }
.m-auto { margin: auto; }
.mx-auto { margin-left: auto; margin-right: auto; }
.mt-4 { margin-top: 1rem; }
.mt-8 { margin-top: 2rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-8 { margin-bottom: 2rem; }

/* Sizing */
.w-full { width: 100%; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }
.max-w-md { max-width: 28rem; }
.max-w-lg { max-width: 32rem; }
.max-w-xl { max-width: 36rem; }
.max-w-2xl { max-width: 42rem; }
.max-w-4xl { max-width: 56rem; }

/* Colors */
.bg-white { background-color: white; }
.bg-gray-50 { background-color: var(--gray-50); }
.bg-gray-100 { background-color: var(--gray-100); }
.bg-primary { background-color: var(--primary); }
.bg-secondary { background-color: var(--secondary); }
.text-white { color: white; }
.text-gray-500 { color: var(--gray-500); }
.text-gray-600 { color: var(--gray-600); }
.text-gray-700 { color: var(--gray-700); }
.text-gray-900 { color: var(--gray-900); }
.text-primary { color: var(--primary); }

/* Typography */
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-base { font-size: 1rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.text-3xl { font-size: 1.875rem; }
.text-4xl { font-size: 2.25rem; }
.text-5xl { font-size: 3rem; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.leading-tight { line-height: 1.25; }
.leading-relaxed { line-height: 1.625; }

/* Borders & Radius */
.border { border: 1px solid var(--gray-200); }
.border-t { border-top: 1px solid var(--gray-200); }
.border-b { border-bottom: 1px solid var(--gray-200); }
.rounded { border-radius: var(--radius); }
.rounded-lg { border-radius: 0.75rem; }
.rounded-xl { border-radius: 1rem; }
.rounded-2xl { border-radius: 1.5rem; }
.rounded-full { border-radius: 9999px; }

/* Shadows */
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow { box-shadow: var(--shadow); }
.shadow-lg { box-shadow: var(--shadow-lg); }

/* Transitions */
.transition { transition: all 0.2s ease; }
.transition-colors { transition: color 0.2s, background-color 0.2s; }
.hover\\:opacity-80:hover { opacity: 0.8; }
.hover\\:shadow-lg:hover { box-shadow: var(--shadow-lg); }
.hover\\:scale-105:hover { transform: scale(1.05); }

/* Buttons */
.btn { 
  display: inline-flex; 
  align-items: center; 
  justify-content: center;
  padding: 0.75rem 1.5rem; 
  border-radius: var(--radius);
  font-weight: 500;
  transition: all 0.2s;
}
.btn-primary { 
  background: var(--primary); 
  color: white; 
}
.btn-primary:hover { 
  background: var(--primary-dark); 
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}
.btn-outline {
  background: transparent;
  border: 2px solid var(--primary);
  color: var(--primary);
}
.btn-outline:hover {
  background: var(--primary);
  color: white;
}

/* Form Elements */
input, textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
input:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(3, 165, 192, 0.1);
}

/* Cards */
.card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Responsive */
@media (max-width: 768px) {
  .md\\:flex-row { flex-direction: column; }
  .md\\:grid-cols-2 { grid-template-columns: 1fr; }
  .md\\:grid-cols-3 { grid-template-columns: 1fr; }
  .text-4xl { font-size: 2rem; }
  .text-5xl { font-size: 2.5rem; }
  .section { padding: 3rem 0; }
}

@media (min-width: 768px) {
  .md\\:flex-row { flex-direction: row; }
  .md\\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .md\\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 0.6s ease forwards; }

/* Contact Form Styles */
.contact-section { padding: 4rem 0; background: var(--gray-50); }
.contact-form { 
  max-width: 600px; 
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-message { 
  padding: 1rem; 
  border-radius: var(--radius);
  text-align: center;
  margin-top: 1rem;
}
.form-message.success { background: #d1fae5; color: #065f46; }
.form-message.error { background: #fee2e2; color: #991b1b; }
`;

export const SandpackPreview = forwardRef<SandpackPreviewHandle, SandpackPreviewProps>(({ 
  projectFiles, 
  previewMode = 'desktop',
  showConsole = false,
  enableInspector = false,
  onIframeReady,
  onInspectorMessage
}, ref) => {
  const { isDark } = useThemeStore();

  // 🔧 Convertir les fichiers au format Sandpack - APPROCHE TOLÉRANTE
  const sandpackFiles = useMemo(() => {
    let files: Record<string, { code: string; active?: boolean }> = {};
    
    // 🔍 DEBUG: Log des fichiers reçus
    console.log('🔍 [SandpackPreview] Received files:', {
      count: Object.keys(projectFiles).length,
      paths: Object.keys(projectFiles),
    });

    // Si aucun fichier, on ne retourne pas vide - on crée un fallback
    if (Object.keys(projectFiles).length === 0) {
      console.warn('⚠️ [SandpackPreview] No project files - creating fallback');
      return createFallbackReactProject({});
    }
    
    // 🔧 PHASE 1: Tenter de convertir un projet HTML en React
    const convertedFiles = detectAndConvertHTMLProject(projectFiles);
    
    // Fichiers à ignorer (config Vite gérée par Sandpack)
    const skipFiles = [
      'package.json', 'package-lock.json', 'bun.lockb',
      'vite.config.ts', 'vite.config.js',
      'tsconfig.json', 'tsconfig.node.json', 'tsconfig.app.json',
      'postcss.config.js', 'tailwind.config.ts', 'tailwind.config.js',
      '.gitignore', 'README.md', '.env', '.env.local',
      'eslint.config.js', 'components.json', 'index.html'
    ];
    
    Object.entries(convertedFiles).forEach(([path, content]) => {
      // Ignorer les fichiers de config
      const fileName = path.split('/').pop() || '';
      if (skipFiles.includes(fileName)) return;
      
      // Ignorer les dossiers de config
      if (path.includes('node_modules/') || path.includes('.git/')) return;
      
      // 🔧 PHASE 3: Normalisation INTELLIGENTE avec aliases
      let sandpackPath = normalizeFilePath(path);
      
      // Nettoyer le contenu des marqueurs markdown résiduels
      let cleanContent = content;
      if (typeof cleanContent === 'string') {
        cleanContent = cleanContent.trim();
        // Supprimer les code blocks markdown si présents
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
        }
        
        // 🔧 PHASE 4: Appliquer les corrections JSX automatiques
        cleanContent = fixJSXSyntaxErrors(cleanContent, sandpackPath);
      }
      
      files[sandpackPath] = { code: cleanContent };
    });

    console.log('🔍 [SandpackPreview] Normalized files:', Object.keys(files));

    // 🔧 PHASE 2: Vérifier si on a les fichiers React essentiels, sinon créer un fallback
    const hasAppTsx = files['/src/App.tsx'] || files['/src/App.jsx'];
    const hasMainTsx = files['/src/main.tsx'] || files['/src/main.jsx'];

    // Si pas de App.tsx valide, créer un fallback
    if (!hasAppTsx) {
      console.warn('⚠️ [SandpackPreview] No App.tsx found - creating fallback');
      files = createFallbackReactProject(files);
    }
    // Si on a App.tsx mais pas main.tsx, le créer
    else if (!hasMainTsx) {
      console.log('📝 [SandpackPreview] Creating missing main.tsx');
      files['/src/main.tsx'] = {
        code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
      };
    }

    // S'assurer qu'on a un fichier CSS de base COMPLET
    if (!files['/src/index.css'] && !files['/index.css']) {
      files['/src/index.css'] = { code: BASE_CSS };
    }
    
    // ✅ Toujours ajouter un index.html personnalisé avec Tailwind CDN
    files['/index.html'] = {
      code: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#03A5C0',
            'primary-dark': '#028a9e',
            secondary: '#1a1a2e',
          }
        }
      }
    }
  </script>
</head>
<body class="antialiased">
  <div id="root"></div>
</body>
</html>`
    };

    // Créer des stubs pour les composants manquants
    files = createMissingComponentStubs(files);

    // Marquer le fichier actif
    if (files['/src/App.tsx']) {
      files['/src/App.tsx'].active = true;
    }

    // Injecter le script d'inspection si activé
    return injectInspectorIntoFiles(files, enableInspector);
  }, [projectFiles, enableInspector]);

  // 🔧 Dépendances pour React avec toutes les librairies courantes
  const dependencies = useMemo(() => ({
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "lucide-react": "^0.462.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "framer-motion": "^12.0.0",
    "@emotion/is-prop-valid": "^1.2.2", // ✅ Requis par framer-motion dans Sandpack
  }), []);

  // Clé stable basée sur le contenu réel pour éviter les re-renders inutiles
  const sandpackKey = useMemo(() => {
    const fileCount = Object.keys(sandpackFiles).length;
    const hasApp = sandpackFiles['/src/App.tsx'] ? 'yes' : 'no';
    // Hash simple basé sur la longueur du contenu
    const contentHash = Object.values(sandpackFiles)
      .map(f => f.code.length)
      .reduce((a, b) => a + b, 0);
    return `sandpack-${fileCount}-${hasApp}-${contentHash}`;
  }, [sandpackFiles]);

  // 🔧 PHASE 5: PLUS DE VALIDATION STRICTE - Sandpack gère toujours le rendu
  // Le fallback est déjà créé dans sandpackFiles si nécessaire
  
  // 🎯 Log final pour debug
  console.log('🚀 [SandpackPreview] Rendering Sandpack with:', {
    fileCount: Object.keys(sandpackFiles).length,
    files: Object.keys(sandpackFiles),
    hasApp: !!sandpackFiles['/src/App.tsx'],
    hasMain: !!sandpackFiles['/src/main.tsx'],
  });

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
          entry: '/src/main.tsx',
          // 🔧 Configuration Babel pour forcer React JSX
          environment: 'create-react-app',
        }}
        theme={isDark ? 'dark' : 'light'}
        options={{
          recompileMode: 'delayed',
          recompileDelay: 150,
          autorun: true,
          autoReload: true,
          bundlerURL: 'https://sandpack-bundler.codesandbox.io',
          // Activer le mode React explicitement
          activeFile: '/src/App.tsx',
          visibleFiles: ['/src/App.tsx', '/src/main.tsx', '/src/index.css'],
          externalResources: [
            'https://cdn.tailwindcss.com',
          ],
          // Configuration du compilateur
          initMode: 'immediate',
          initModeObserverOptions: { rootMargin: '1000px' },
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
