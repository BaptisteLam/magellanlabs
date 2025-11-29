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

  // Hot reload HTML avec DOM diffing basique
  const hotReloadHTML = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document) return;

    try {
      // Sauvegarder l'état actuel
      const scrollX = iframe.contentWindow.scrollX;
      const scrollY = iframe.contentWindow.scrollY;
      const formData = new Map<string, string>();
      
      // Sauvegarder les valeurs des formulaires
      iframe.contentWindow.document.querySelectorAll('input, textarea, select').forEach((el: any) => {
        if (el.name || el.id) {
          const key = el.name || el.id;
          formData.set(key, el.value);
        }
      });

      // Parser le nouveau HTML
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(generatedHTML, 'text/html');
      
      // Mettre à jour le body uniquement (préserve head et scripts)
      if (iframe.contentWindow.document.body && newDoc.body) {
        // Simple DOM replacement pour éviter la complexité du diffing complet
        iframe.contentWindow.document.body.innerHTML = newDoc.body.innerHTML;
        
        // Restaurer les valeurs des formulaires
        iframe.contentWindow.document.querySelectorAll('input, textarea, select').forEach((el: any) => {
          const key = el.name || el.id;
          if (key && formData.has(key)) {
            el.value = formData.get(key);
          }
        });
        
        // Restaurer la position de scroll
        iframe.contentWindow.scrollTo(scrollX, scrollY);
        
        console.log('📄 HTML mis à jour avec préservation de l\'état');
      } else {
        // Fallback si le DOM est trop différent
        fullReload();
      }
    } catch (error) {
      console.error('HTML hot reload error, falling back to full reload:', error);
      fullReload();
    }
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

  // Charger l'iframe initialement et lors des changements
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Première fois : chargement initial
    if (initialLoadRef.current) {
      iframe.srcdoc = generatedHTML;
      iframe.onload = () => {
        setIframeReady(true);
        initialLoadRef.current = false;
      };
    }
    // Les changements suivants sont gérés par useHotReload
  }, [generatedHTML]); // Dépend de generatedHTML pour détecter les changements

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
