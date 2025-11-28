import { useRef, useEffect, useState, useMemo } from 'react';
import { useHotReload } from '@/hooks/useHotReload';
import { HotReloadIndicator } from './HotReloadIndicator';
import { generate404Page } from '@/lib/generate404Page';

interface HotReloadableIframeProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function HotReloadableIframe({
  projectFiles,
  isDark = false,
  inspectMode = false,
  onElementSelect,
}: HotReloadableIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentFile, setCurrentFile] = useState<string>('index.html');
  const [iframeReady, setIframeReady] = useState(false);
  const initialLoadRef = useRef(true);

  // Hook de Hot Reload
  const { isUpdating, lastUpdateType } = useHotReload(projectFiles, {
    onUpdate: (type, file) => {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        return;
      }

      console.log('🔥 Hot Reload trigger:', type, file);

      if (!iframeRef.current?.contentWindow) return;

      try {
        if (type === 'css') {
          // Hot reload CSS sans recharger la page
          hotReloadCSS();
        } else if (type === 'html') {
          // Hot reload HTML (mise à jour différentielle du DOM)
          hotReloadHTML();
        } else {
          // Rechargement complet pour JS ou modifications majeures
          fullReload();
        }
      } catch (error) {
        console.error('Hot reload error:', error);
        fullReload();
      }
    },
  });

  // Générer le HTML complet
  const generatedHTML = useMemo(() => {
    if (currentFile === '__404__') {
      return generate404Page(isDark);
    }

    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return '<html><body><div style="display:flex;align-items:center;justify-center;height:100vh;font-family:system-ui">Generating preview...</div></body></html>';
    }

    // Collecter CSS
    const cssFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.css'))
      .map(([_, content]) => content)
      .join('\n');

    // Collecter JS
    const jsFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.js'))
      .map(([_, content]) => content)
      .join('\n');

    // Trouver le fichier HTML
    let htmlContent = '';
    const htmlFile = Object.entries(projectFiles).find(
      ([path]) => path === currentFile || path.endsWith('/' + currentFile)
    );

    if (htmlFile) {
      htmlContent = htmlFile[1];
    } else {
      htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
    }

    // Injecter CSS et JS dans le HTML
    const processedHTML = htmlContent
      .replace('</head>', `<style id="__hot_css__">${cssFiles}</style></head>`)
      .replace('</body>', `<script id="__hot_js__">${jsFiles}</script></body>`);

    return processedHTML;
  }, [projectFiles, currentFile, isDark]);

  // Hot reload CSS uniquement
  const hotReloadCSS = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document) return;

    const cssContent = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.css'))
      .map(([_, content]) => content)
      .join('\n');

    // Trouver ou créer la balise style
    let styleElement = iframe.contentWindow.document.getElementById(
      '__hot_css__'
    ) as HTMLStyleElement;

    if (styleElement) {
      styleElement.textContent = cssContent;
      console.log('🎨 CSS mis à jour sans rechargement');
    } else {
      // Créer la balise si elle n'existe pas
      styleElement = iframe.contentWindow.document.createElement('style');
      styleElement.id = '__hot_css__';
      styleElement.textContent = cssContent;
      iframe.contentWindow.document.head.appendChild(styleElement);
    }

    // Animation flash subtile pour indiquer le changement
    flashChangedElements(iframe.contentWindow.document);
  };

  // Hot reload HTML (mise à jour différentielle)
  const hotReloadHTML = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document) return;

    // Pour HTML, on recharge complètement car la mise à jour différentielle
    // du DOM est complexe et peut casser des event listeners
    fullReload();
  };

  // Rechargement complet
  const fullReload = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Sauvegarder l'état de scroll
    const scrollX = iframe.contentWindow?.scrollX || 0;
    const scrollY = iframe.contentWindow?.scrollY || 0;

    // Recharger
    iframe.srcdoc = generatedHTML;

    // Restaurer le scroll après le chargement
    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.scrollTo(scrollX, scrollY);
      }
      setIframeReady(true);
    };
  };

  // Animation flash pour les éléments modifiés
  const flashChangedElements = (doc: Document) => {
    const style = doc.createElement('style');
    style.textContent = `
      @keyframes hot-reload-flash {
        0%, 100% { outline: 2px solid transparent; }
        50% { outline: 2px solid rgba(3, 165, 192, 0.6); }
      }
      body {
        animation: hot-reload-flash 0.3s ease-in-out;
      }
    `;
    doc.head.appendChild(style);
    setTimeout(() => style.remove(), 400);
  };

  // Charger l'iframe initialement
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.srcdoc = generatedHTML;
    iframe.onload = () => {
      setIframeReady(true);
      initialLoadRef.current = false;
    };
  }, []); // Uniquement au mount

  return (
    <>
      <HotReloadIndicator isUpdating={isUpdating} updateType={lastUpdateType} />
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="Preview"
      />
    </>
  );
}
