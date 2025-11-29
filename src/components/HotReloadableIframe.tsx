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
  const [inspectReady, setInspectReady] = useState(false);
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

  // Script d'inspection pour le click-to-edit
  const inspectionScript = `
    <style id="__magellan_inspect_styles__">
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
    </style>
    <script>
      (function() {
        let isInspectMode = false;
        let hoveredElement = null;
        let mouseMoveHandler = null;
        let clickHandler = null;
        
        function init() {
          window.addEventListener('message', (e) => {
            if (e.data.type === 'toggle-inspect') {
              isInspectMode = e.data.enabled;
              if (isInspectMode) {
                activateInspection();
              } else {
                deactivateInspection();
              }
            }
          });
        }
        
        function activateInspection() {
          document.body.style.cursor = 'crosshair';
          showAllOutlines();
          attachEventListeners();
        }
        
        function deactivateInspection() {
          document.body.style.cursor = 'default';
          if (hoveredElement) {
            hoveredElement.classList.remove('magellan-inspect-highlight');
            hoveredElement.removeAttribute('data-magellan-tag');
            hoveredElement = null;
          }
          hideAllOutlines();
          detachEventListeners();
        }
        
        function attachEventListeners() {
          mouseMoveHandler = (e) => {
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
          };
          
          clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const target = e.target;
            if (target === document.body || target === document.documentElement) return;
            
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
            
            window.parent.postMessage({
              type: 'element-selected',
              data: elementInfo
            }, '*');
            
            return false;
          };
          
          document.addEventListener('mousemove', mouseMoveHandler, true);
          document.addEventListener('click', clickHandler, true);
        }
        
        function detachEventListeners() {
          if (mouseMoveHandler) {
            document.removeEventListener('mousemove', mouseMoveHandler, true);
            mouseMoveHandler = null;
          }
          if (clickHandler) {
            document.removeEventListener('click', clickHandler, true);
            clickHandler = null;
          }
        }
        
        function showAllOutlines() {
          const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
          const elements = document.querySelectorAll(selectableTags.join(','));
          elements.forEach(el => {
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
          if (tag === 'button') return 'Bouton';
          if (tag === 'a') return 'Lien';
          if (tag === 'p') return 'Paragraphe';
          if (tag === 'img') return 'Image';
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
        
        init();
        window.parent.postMessage({ type: 'inspect-ready' }, '*');
      })();
    </script>
  `;

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

    // Injecter le script d'inspection, CSS et JS dans le HTML
    const processedHTML = htmlContent
      .replace('</head>', `${inspectionScript}<style id="__hot_css__">${cssFiles}</style></head>`)
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
      setInspectReady(false); // Reset inspect ready on full reload
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

  // Écouter les messages de l'iframe pour l'inspection
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'inspect-ready') {
        console.log('✅ Iframe inspection ready');
        setInspectReady(true);
      } else if (event.data.type === 'element-selected' && onElementSelect) {
        console.log('📥 Element selected:', event.data.data);
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Envoyer le toggle inspect mode à l'iframe
  useEffect(() => {
    if (!inspectReady || !iframeRef.current?.contentWindow) return;

    console.log('📤 Sending toggle-inspect:', inspectMode);
    iframeRef.current.contentWindow.postMessage(
      { type: 'toggle-inspect', enabled: inspectMode },
      '*'
    );
  }, [inspectMode, inspectReady]);

  // Charger l'iframe initialement et lors des changements
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Première fois : chargement initial
    if (initialLoadRef.current) {
      iframe.srcdoc = generatedHTML;
      iframe.onload = () => {
        setIframeReady(true);
        setInspectReady(false); // Reset inspect ready on reload
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
