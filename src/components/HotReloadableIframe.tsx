import { useRef, useEffect, useState, useMemo } from 'react';
import { useHotReload } from '@/hooks/useHotReload';
import { HotReloadIndicator } from './HotReloadIndicator';
import { generate404Page } from '@/lib/generate404Page';
import { type ElementInfo } from './InspectOverlay';

interface HotReloadableIframeProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
}

export function HotReloadableIframe({
  projectFiles,
  isDark = false,
  inspectMode = false,
  onElementSelect,
}: HotReloadableIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentFile, setCurrentFile] = useState<string>('index.html');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['index.html']);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  const [inspectReady, setInspectReady] = useState(false);
  const initialLoadRef = useRef(true);
  const lastReloadTimeRef = useRef(0);
  const hadFilesRef = useRef(false);

  // Hook de Hot Reload
  const { isUpdating, lastUpdateType } = useHotReload(projectFiles, {
    onUpdate: (type, file) => {
      // Éviter les reloads trop fréquents (debounce 100ms)
      const now = Date.now();
      if (now - lastReloadTimeRef.current < 100) {
        console.log('⏭️ Hot reload ignoré (debounce)');
        return;
      }
      lastReloadTimeRef.current = now;

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
    <script id="__magellan_inspect_script__">
      (function() {
        console.log('🔍 Magellan Inspect Script initialized');
        
        let isInspectMode = false;
        let hoveredElement = null;
        let mouseMoveHandler = null;
        let clickHandler = null;
        let pendingInspectMode = null;
        
        // Injecter les styles d'inspection
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
          console.log('✅ Styles d\\'inspection injectés');
        };
        
        function showAllOutlines() {
          console.log('👁️ Affichage des outlines');
          const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV','UL','LI'];
          const elements = document.querySelectorAll(selectableTags.join(','));
          console.log('📊 Éléments trouvés:', elements.length);
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
          console.log('🎯 Init inspect mode listener');
          
          window.addEventListener('message', (e) => {
            console.log('📨 Message reçu:', e.data);
            if (e.data.type === 'toggle-inspect') {
              const newState = e.data.enabled;
              console.log('🔄 Toggle inspect mode:', newState, '(état actuel:', isInspectMode, ')');
              
              // Si le document n'est pas prêt, stocker le mode en attente
              if (document.readyState !== 'complete') {
                console.log('⏳ Document pas prêt, mode stocké en attente');
                pendingInspectMode = newState;
                return;
              }
              
              // Éviter les toggles redondants
              if (isInspectMode === newState) {
                console.log('⚠️ État déjà à', newState, '- pas de changement');
                return;
              }
              
              isInspectMode = newState;
              if (isInspectMode) {
                activateInspection();
              } else {
                deactivateInspection();
              }
            }
          });
          
          console.log('✅ Event listener message installé');
          
          // Envoyer inspect-ready immédiatement
          console.log('📤 Envoi de inspect-ready (immédiat)');
          window.parent.postMessage({ type: 'inspect-ready' }, '*');
          
          // Envoyer également après DOMContentLoaded
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
              console.log('📤 Envoi de inspect-ready (DOMContentLoaded)');
              window.parent.postMessage({ type: 'inspect-ready' }, '*');
            });
          }
          
          // Et après window.load
          window.addEventListener('load', () => {
            console.log('📤 Envoi de inspect-ready (window.load)');
            window.parent.postMessage({ type: 'inspect-ready' }, '*');
            
            // Appliquer le mode en attente si présent
            if (pendingInspectMode !== null) {
              console.log('✅ Application du mode en attente:', pendingInspectMode);
              isInspectMode = pendingInspectMode;
              if (isInspectMode) {
                activateInspection();
              } else {
                deactivateInspection();
              }
              pendingInspectMode = null;
            }
          });
          
          // Répéter périodiquement pendant 2 secondes pour garantir réception
          let readyAttempts = 0;
          const readyInterval = setInterval(() => {
            console.log('📤 Envoi de inspect-ready (retry', readyAttempts + 1, ')');
            window.parent.postMessage({ type: 'inspect-ready' }, '*');
            readyAttempts++;
            if (readyAttempts > 6) {
              clearInterval(readyInterval);
              console.log('✅ Fin des retries inspect-ready');
            }
          }, 300);
        }
        
        function activateInspection() {
          console.log('✨ Activation du mode inspection');
          injectStyles();
          document.body.style.cursor = 'crosshair';
          
          // IMPORTANT: Toujours afficher les outlines à l'activation
          console.log('👁️ Affichage forcé des outlines à l'activation');
          showAllOutlines();
          
          attachEventListeners();
          console.log('✅ Mode inspection activé avec outlines visibles');
        }
        
        function deactivateInspection() {
          console.log('🔚 Désactivation du mode inspection');
          document.body.style.cursor = 'default';
          
          // Retirer le highlight de l'élément survolé
          if (hoveredElement) {
            hoveredElement.classList.remove('magellan-inspect-highlight');
            hoveredElement.removeAttribute('data-magellan-tag');
            hoveredElement = null;
            console.log('🗑️ Highlight retiré de l\'élément survolé');
          }
          
          // IMPORTANT: Toujours cacher les outlines à la désactivation
          console.log('🙈 Masquage forcé des outlines à la désactivation');
          hideAllOutlines();
          
          detachEventListeners();
          console.log('✅ Mode inspection désactivé - outlines masqués');
        }
        
        function attachEventListeners() {
          console.log('🎧 Attachement des event listeners');
          
          mouseMoveHandler = (e) => {
            if (!isInspectMode) return;
            
            const target = e.target;
            if (target === hoveredElement) return;
            if (target === document.body || target === document.documentElement) return;
            
            const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV','UL','LI'];
            if (!selectableTags.includes(target.tagName)) return;
            
            console.log('🎯 Hover sur:', target.tagName, target.textContent?.substring(0, 30));
            
            if (hoveredElement) {
              hoveredElement.classList.remove('magellan-inspect-highlight');
              hoveredElement.removeAttribute('data-magellan-tag');
            }
            
            hoveredElement = target;
            const elementType = getElementDescription(target);
            target.setAttribute('data-magellan-tag', elementType);
            target.classList.add('magellan-inspect-highlight');
            
            console.log('✨ Outline appliqué sur:', elementType);
          };
          
          clickHandler = (e) => {
            // Vérifier que le mode inspection est bien actif
            if (!isInspectMode) {
              console.log('⚠️ Click handler appelé mais mode inspection désactivé');
              return;
            }
            
            console.log('👆 Click détecté sur:', e.target.tagName);
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
            
            console.log('📤 Envoi de element-selected:', elementInfo);
            window.parent.postMessage({
              type: 'element-selected',
              data: elementInfo
            }, '*');
            
            return false;
          };
          
          document.addEventListener('mousemove', mouseMoveHandler, true);
          document.addEventListener('click', clickHandler, true);
          console.log('✅ Event listeners attachés');
        }
        
         // Intercepter les clics sur liens pour navigation interne
        // IMPORTANT: Ne pas intercepter en mode inspection
        document.addEventListener('click', function(e) {
          // Si mode inspection actif, ne rien faire - laisser le clickHandler gérer
          if (isInspectMode) {
            return;
          }
          
          const target = e.target.closest('a');
          if (target && target.href) {
            const href = target.getAttribute('href') || '';
            
            // Bloquer les liens externes
            if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              e.preventDefault();
              e.stopPropagation();
              alert('❌ Les liens externes sont bloqués dans la preview.');
              return false;
            }
            
            // CRITICAL: Bloquer ABSOLUMENT tout lien vers /builder
            if (href.includes('/builder') || href.includes('builder')) {
              e.preventDefault();
              e.stopPropagation();
              console.log('🚫 Navigation vers /builder bloquée');
              return false;
            }
            
            // Ancres (navigation dans la même page)
            if (href.startsWith('#')) {
              return true;
            }
            
            // TOUJOURS bloquer la navigation par défaut pour les liens internes
            e.preventDefault();
            e.stopPropagation();
            
            // Calculer le fichier cible
            let targetFile = href.replace(/^\/+/, ''); // Enlever les slashes au début
            
            // Si vide ou "/", naviguer vers index.html
            if (!targetFile || targetFile === '' || targetFile === '/') {
              targetFile = 'index.html';
            }
            
            console.log('🔗 Navigation interne vers:', targetFile);
            window.parent.postMessage({
              type: 'navigate',
              file: targetFile
            }, '*');
            
            return false;
          }
        }, true);
        
        function detachEventListeners() {
          console.log('🔌 Détachement des event listeners');
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
        
        // Intercepter les clics sur liens (APRÈS le click handler d'inspection)
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href && !isInspectMode) {
            const href = target.getAttribute('href') || '';
            
            // Bloquer TOUS les liens externes - la preview est complètement isolée
            if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              
              const errorDiv = document.createElement('div');
              errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#000;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;max-width:400px;text-align:center;font-family:system-ui;';
              errorDiv.innerHTML = '<h3 style="margin:0 0 1rem 0;font-size:1.25rem;color:#dc2626;">🚫 Lien externe bloqué</h3>' +
                '<p style="margin:0 0 1rem 0;color:#666;">Les liens externes sont désactivés dans la preview. Cette preview est complètement isolée.</p>' +
                '<button onclick="this.parentElement.remove()" style="background:rgb(3,165,192);color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:9999px;cursor:pointer;font-size:1rem;font-weight:500;">Fermer</button>';
              document.body.appendChild(errorDiv);
              setTimeout(() => errorDiv.remove(), 3000);
              return false;
            }
            
            // Ancres (navigation dans la même page)
            if (href.startsWith('#')) {
              return true;
            }
            
            // Navigation multi-pages interne uniquement
            const pathname = href.replace(/^\//, '');
            if (pathname && pathname !== '' && pathname !== '/') {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              
              console.log('🔗 Navigation interne vers:', pathname);
              window.parent.postMessage({
                type: 'navigate',
                file: pathname
              }, '*');
              return false;
            }
          }
        }, true);
        
        // Bloquer window.location programmatique
        const originalLocationHref = Object.getOwnPropertyDescriptor(window.location, 'href');
        Object.defineProperty(window.location, 'href', {
          get: function() {
            return originalLocationHref?.get?.call(window.location);
          },
          set: function(value) {
            if (!isInspectMode && typeof value === 'string') {
              console.log('🚫 Tentative de modification de location.href bloquée:', value);
              
              // Si c'est une navigation interne, l'intercepter
              if (!value.startsWith('http') && !value.startsWith('//')) {
                const pathname = value.replace(/^\//, '').split('?')[0].split('#')[0];
                if (pathname) {
                  window.parent.postMessage({
                    type: 'navigate',
                    file: pathname
                  }, '*');
                  return;
                }
              }
            }
            return originalLocationHref?.set?.call(window.location, value);
          }
        });
        
        // Bloquer history manipulation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
          if (!isInspectMode && url && typeof url === 'string') {
            const pathname = url.replace(/^\//, '').split('?')[0].split('#')[0];
            if (pathname && !pathname.startsWith('http')) {
              console.log('🔗 history.pushState intercepté:', pathname);
              window.parent.postMessage({
                type: 'navigate',
                file: pathname
              }, '*');
              return;
            }
          }
          return originalPushState.apply(this, arguments);
        };
        
        history.replaceState = function(state, title, url) {
          if (!isInspectMode && url && typeof url === 'string') {
            const pathname = url.replace(/^\//, '').split('?')[0].split('#')[0];
            if (pathname && !pathname.startsWith('http')) {
              console.log('🔗 history.replaceState intercepté:', pathname);
              window.parent.postMessage({
                type: 'navigate',
                file: pathname
              }, '*');
              return;
            }
          }
          return originalReplaceState.apply(this, arguments);
        };
        
        // MutationObserver pour intercepter les liens dynamiques ajoutés
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === 1) { // Element node
                const links = node.tagName === 'A' ? [node] : node.querySelectorAll('a');
                links.forEach(function(link) {
                  if (!link.hasAttribute('data-magellan-intercepted')) {
                    link.setAttribute('data-magellan-intercepted', 'true');
                  }
                });
              }
            });
          });
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Initialiser après le chargement du DOM
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            init();
            console.log('✅ Inspect mode ready (DOMContentLoaded)');
            window.parent.postMessage({ type: 'inspect-ready' }, '*');
          });
        } else {
          init();
          console.log('✅ Inspect mode ready (immediate)');
          window.parent.postMessage({ type: 'inspect-ready' }, '*');
        }
        
        // Envoi redondant sur window.load pour garantir la réception
        window.addEventListener('load', () => {
          console.log('🔄 Re-sending inspect-ready on window.load');
          window.parent.postMessage({ type: 'inspect-ready' }, '*');
        });
        
        // Bloquer toute tentative de navigation externe
        window.addEventListener('beforeunload', function(e) {
          console.log('🚫 Tentative de navigation externe bloquée');
          e.preventDefault();
          e.returnValue = '';
          return '';
        });
      })();
    </script>
  `;

  // Générer le HTML complet - stabilisé pour éviter re-génération inutile
  const generatedHTML = useMemo(() => {
    if (currentFile === '__404__') {
      // Injecter le script d'inspection dans la page 404 aussi
      const page404 = generate404Page(isDark);
      return page404.replace(/<\/head\s*>/i, `${inspectionScript}</head>`);
    }

    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Preview</title>
  ${inspectionScript}
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666">
    Generating preview...
  </div>
</body>
</html>`;
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

    // Injecter le script d'inspection, CSS et JS dans le HTML (insensible à la casse)
    // On injecte le script d'inspection en premier dans le head pour qu'il soit toujours actif
    const processedHTML = htmlContent
      .replace(/<\/head\s*>/i, `<style id="__hot_css__">${cssFiles}</style>${inspectionScript}</head>`)
      .replace(/<\/body\s*>/i, `<script id="__hot_js__">${jsFiles}</script></body>`);

    return processedHTML;
  }, [
    // Dépendances stables basées sur le contenu réel
    JSON.stringify(Object.keys(projectFiles).sort()),
    ...Object.values(projectFiles),
    currentFile,
    isDark
  ]);

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
        // NOTE: Ne PAS réinitialiser inspectReady car le script d'inspection reste dans le <head>
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

    console.log('🔄 Full reload');
    setInspectReady(false); // Réinitialiser pour attendre le nouveau script

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
      console.log('✅ Iframe rechargée complètement');
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

  // Écouter les messages de l'iframe pour l'inspection et navigation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'inspect-ready') {
        console.log('✅ Iframe inspection ready');
        setInspectReady(true);
      } else if (event.data.type === 'element-selected' && onElementSelect) {
        console.log('📥 Element selected:', event.data.data);
        onElementSelect(event.data.data);
      } else if (event.data.type === 'navigate') {
        const filename = event.data.file;
        console.log('🔗 Message de navigation reçu:', filename);
        
        // Vérifier si le fichier existe dans projectFiles
        const fileExists = Object.keys(projectFiles).some(path => 
          path === filename || path.endsWith('/' + filename)
        );
        
        if (fileExists) {
          // Ajouter à l'historique et naviguer
          setNavigationHistory(prev => {
            const newHistory = prev.slice(0, navigationIndex + 1);
            return [...newHistory, filename];
          });
          setNavigationIndex(prev => prev + 1);
          setCurrentFile(filename);
          console.log('✅ Navigation vers:', filename);
        } else {
          // Afficher la page 404
          console.log('❌ Fichier non trouvé:', filename);
          setCurrentFile('__404__');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, projectFiles, navigationIndex]);

  // Envoyer le toggle inspect mode à l'iframe - ATTENDRE que l'iframe soit prête
  useEffect(() => {
    // CRITIQUE: Attendre que l'iframe inspection soit prête avant d'envoyer le message
    if (!inspectReady) {
      console.log('⏳ En attente de inspect-ready avant d\'envoyer toggle-inspect');
      return;
    }

    if (!iframeRef.current?.contentWindow) {
      console.warn('❌ contentWindow non disponible');
      return;
    }
    
    // Timeout de sécurité 500ms pour garantir que l'iframe est complètement prête
    const securityTimeout = setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        console.log('📤 Sending toggle-inspect:', inspectMode, '(après timeout sécurité 500ms)');
        iframeRef.current.contentWindow.postMessage(
          { type: 'toggle-inspect', enabled: inspectMode },
          '*'
        );
      }
    }, 500);
    
    return () => clearTimeout(securityTimeout);
  }, [inspectMode, inspectReady]);

  // Charger l'iframe uniquement au premier mount
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !initialLoadRef.current) return;

    // Première fois : chargement initial uniquement
    iframe.srcdoc = generatedHTML;
    iframe.onload = () => {
      setIframeReady(true);
      // Ne pas réinitialiser inspectReady - l'iframe enverra 'inspect-ready' automatiquement
      initialLoadRef.current = false;
    };
    
    // Ne pas re-exécuter ce useEffect après le premier mount
    // Les changements suivants sont gérés exclusivement par useHotReload
  }, []); // Dépendances vides = exécuté uniquement au premier mount

  // Forcer un reload complet quand les fichiers arrivent pour la première fois
  useEffect(() => {
    const hasFiles = Object.keys(projectFiles).length > 0;
    
    // Si on passe de "pas de fichiers" à "fichiers présents", forcer reload complet
    if (!hadFilesRef.current && hasFiles) {
      console.log('📁 Fichiers reçus pour la première fois, reload complet');
      fullReload();
    }
    
    hadFilesRef.current = hasFiles;
  }, [projectFiles]);

  // Recharger l'iframe quand currentFile change (navigation entre pages ou affichage 404)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || initialLoadRef.current) return; // Skip lors du premier mount
    
    console.log('🔄 Rechargement iframe pour nouvelle page:', currentFile);
    
    // CRITIQUE: Réinitialiser inspectReady car le script sera rechargé
    setInspectReady(false);
    
    // Sauvegarder l'état de scroll si c'est une navigation normale
    const scrollX = iframe.contentWindow?.scrollX || 0;
    const scrollY = iframe.contentWindow?.scrollY || 0;
    
    // Recharger avec le nouveau contenu
    iframe.srcdoc = generatedHTML;
    
    iframe.onload = () => {
      // Ne restaurer le scroll que si ce n'est pas la page 404
      if (currentFile !== '__404__' && iframe.contentWindow) {
        iframe.contentWindow.scrollTo(scrollX, scrollY);
      }
      setIframeReady(true);
    };
  }, [currentFile, generatedHTML]);

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
