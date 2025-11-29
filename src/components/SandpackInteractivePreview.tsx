import { useEffect, useRef, useState } from 'react';
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { generate404Page } from '@/lib/generate404Page';

interface SandpackInteractivePreviewProps {
  files: Record<string, string>;
  isDark: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

function SandpackController({ inspectMode, onElementSelect }: { inspectMode: boolean; onElementSelect?: (elementInfo: any) => void }) {
  const { sandpack } = useSandpack();
  const [iframeReady, setIframeReady] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 10;

  // Script d'inspection adapté pour Sandpack React
  const inspectionScript = `
    (function() {
      console.log('🔍 Magellan Inspect Script initialized in Sandpack');
      
      let isInspectMode = false;
      let hoveredElement = null;
      let mouseMoveHandler = null;
      let clickHandler = null;
      
      const injectStyles = () => {
        if (document.getElementById('__magellan_inspect_styles__')) return;
        
        const style = document.createElement('style');
        style.id = '__magellan_inspect_styles__';
        style.textContent = \`
          .magellan-inspect-highlight {
            outline: 2px solid #03A5C0 !important;
            outline-offset: 2px !important;
            cursor: pointer !important;
            position: relative;
            z-index: 999998 !important;
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
            white-space: nowrap;
          }
          .magellan-inspect-dashed {
            outline: 1px dashed rgba(3, 165, 192, 0.3) !important;
            outline-offset: 2px;
          }
        \`;
        document.head.appendChild(style);
      };
      
      function showAllOutlines() {
        const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV','UL','LI'];
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
        
        // Block external navigation attempts
        window.addEventListener('beforeunload', function(e) {
          console.log('🚫 Tentative de navigation externe bloquée');
          e.preventDefault();
          e.returnValue = '';
          return '';
        });

        // Intercept link clicks to prevent navigation outside preview
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href) {
            const href = target.getAttribute('href') || '';
            
            // Block external links
            if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              e.preventDefault();
              e.stopPropagation();
              alert('❌ Les liens externes sont bloqués dans la preview.');
              return false;
            }
            
            // CRITICAL: Block ANY link to /builder
            if (href.includes('/builder') || href.includes('builder')) {
              e.preventDefault();
              e.stopPropagation();
              console.log('🚫 Navigation vers /builder bloquée');
              return false;
            }
            
            // Allow anchor links (same page navigation)
            if (href.startsWith('#')) {
              return true;
            }
            
            // TOUJOURS bloquer la navigation par défaut pour les liens internes
            e.preventDefault();
            e.stopPropagation();
            
            // Calculer le fichier cible
            let targetFile = href.replace(/^\/+/, ''); // Enlever les slashes au début
            
            // Si vide ou "/", naviguer vers index.tsx ou App.tsx
            if (!targetFile || targetFile === '' || targetFile === '/') {
              targetFile = 'App.tsx';
            }
            
            console.log('🔗 Navigation interne vers:', targetFile);
            window.parent.postMessage({
              type: 'navigate',
              file: targetFile
            }, '*');
            
            return false;
          }
        }, true);
      }
      
      function activateInspection() {
        console.log('✨ Activation du mode inspection');
        injectStyles();
        document.body.style.cursor = 'crosshair';
        showAllOutlines();
        attachEventListeners();
      }
      
      function deactivateInspection() {
        console.log('🔚 Désactivation du mode inspection');
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
          if (!isInspectMode) return;
          
          const target = e.target;
          if (target === hoveredElement) return;
          if (target === document.body || target === document.documentElement) return;
          
          const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV','UL','LI'];
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
          if (!isInspectMode) return;
          
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
      
      function getElementDescription(el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'h1') return 'Titre H1';
        if (tag === 'h2') return 'Titre H2';
        if (tag === 'h3') return 'Titre H3';
        if (tag === 'button') return 'Bouton';
        if (tag === 'a') return 'Lien';
        if (tag === 'p') return 'Paragraphe';
        if (tag === 'img') return 'Image';
        if (tag === 'svg') return 'Icône';
        if (tag === 'div') return 'Conteneur';
        if (tag === 'section') return 'Section';
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
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          init();
          window.parent.postMessage({ type: 'inspect-ready' }, '*');
        });
      } else {
        init();
        window.parent.postMessage({ type: 'inspect-ready' }, '*');
      }
      
      window.addEventListener('load', () => {
        window.parent.postMessage({ type: 'inspect-ready' }, '*');
      });
    })();
  `;

  // Injecter le script dans l'iframe Sandpack
  useEffect(() => {
    const injectScript = () => {
      const iframe = sandpack.clients.main?.iframe;
      
      if (!iframe?.contentWindow) {
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`🔄 Retry ${retryCountRef.current}/${maxRetries} - iframe not ready`);
          setTimeout(injectScript, 300 * retryCountRef.current);
        }
        return;
      }

      try {
        const iframeDoc = iframe.contentWindow.document;
        
        // Vérifier si le script est déjà injecté
        if (iframeDoc.getElementById('__magellan_inspect_script__')) {
          console.log('✅ Script d\'inspection déjà présent');
          setIframeReady(true);
          return;
        }

        const script = iframeDoc.createElement('script');
        script.id = '__magellan_inspect_script__';
        script.textContent = inspectionScript;
        iframeDoc.head.insertBefore(script, iframeDoc.head.firstChild);
        
        console.log('✅ Script d\'inspection injecté dans Sandpack');
        setIframeReady(true);
        retryCountRef.current = 0;
      } catch (error) {
        console.error('❌ Erreur injection script:', error);
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(injectScript, 300 * retryCountRef.current);
        }
      }
    };

    // Attendre que Sandpack soit prêt
    if (sandpack.status === 'running') {
      setTimeout(injectScript, 500);
    }
  }, [sandpack.status]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'inspect-ready') {
        console.log('✅ Inspect mode ready dans Sandpack');
        setIframeReady(true);
      } else if (event.data.type === 'element-selected') {
        console.log('📥 Element sélectionné:', event.data.data);
        onElementSelect?.(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Toggle inspect mode
  useEffect(() => {
    if (!iframeReady) return;

    const iframe = sandpack.clients.main?.iframe;
    if (!iframe?.contentWindow) return;

    console.log('🔄 Toggle inspect mode:', inspectMode);
    iframe.contentWindow.postMessage(
      { type: 'toggle-inspect', enabled: inspectMode },
      '*'
    );
  }, [inspectMode, iframeReady, sandpack.clients]);

  return null;
}

export function SandpackInteractivePreview({ files, isDark, inspectMode = false, onElementSelect }: SandpackInteractivePreviewProps) {
  const [currentFile, setCurrentFile] = useState<string>('App.tsx');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['App.tsx']);
  const [navigationIndex, setNavigationIndex] = useState(0);

  // Handler pour les messages de navigation depuis l'iframe
  useEffect(() => {
    const handleNavigationMessage = (event: MessageEvent) => {
      if (event.data.type === 'navigate') {
        const targetFile = event.data.file;
        console.log('📨 Message navigate reçu:', targetFile);
        
        // Vérifier si le fichier existe
        const fileExists = files[targetFile] || files[`/${targetFile}`] || files[`./${targetFile}`];
        
        if (fileExists) {
          console.log('✅ Fichier trouvé, navigation vers:', targetFile);
          setCurrentFile(targetFile);
          
          // Mettre à jour l'historique
          const newHistory = navigationHistory.slice(0, navigationIndex + 1);
          newHistory.push(targetFile);
          setNavigationHistory(newHistory);
          setNavigationIndex(newHistory.length - 1);
        } else {
          console.log('❌ Fichier introuvable:', targetFile, '- Affichage page 404');
          setCurrentFile('__404__');
        }
      }
    };

    window.addEventListener('message', handleNavigationMessage);
    return () => window.removeEventListener('message', handleNavigationMessage);
  }, [files, navigationHistory, navigationIndex]);

  // Générer les fichiers avec page 404 si nécessaire
  const filesWithNotFound = {
    ...files,
    ...(currentFile === '__404__' && {
      '/404.html': generate404Page(isDark)
    })
  };

  return (
    <SandpackProvider
      template="react-ts"
      files={filesWithNotFound}
      theme={isDark ? 'dark' : 'light'}
      options={{
        autoReload: true,
        recompileMode: 'delayed',
        recompileDelay: 300,
      }}
    >
      <div className="h-full w-full relative">
        <SandpackController inspectMode={inspectMode} onElementSelect={onElementSelect} />
        <SandpackLayout>
          <SandpackPreview 
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            style={{ height: '100%' }}
          />
        </SandpackLayout>
      </div>
    </SandpackProvider>
  );
}
