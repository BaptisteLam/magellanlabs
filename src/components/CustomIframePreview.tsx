import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { generate404Page } from '@/lib/generate404Page';

interface CustomIframePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function CustomIframePreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: CustomIframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentFile, setCurrentFile] = useState<string>('index.html');
  const [reloadKey, setReloadKey] = useState(0);

  // Générer le HTML complet avec script d'inspection intégré
  const generatedHTML = useMemo(() => {
    console.log('📦 CustomIframePreview - currentFile:', currentFile);
    console.log('📦 CustomIframePreview - projectFiles:', Object.keys(projectFiles));
    
    // Si on demande la page 404
    if (currentFile === '__404__') {
      console.log('🚫 Affichage de la page 404');
      return generate404Page(isDark);
    }
    
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      console.log('⚠️ Aucun fichier de projet');
      return '<html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">Generating preview...</div></body></html>';
    }

    // Collecter tous les CSS
    const cssFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.css'))
      .map(([_, content]) => content)
      .join('\n');

    console.log('📦 CSS collecté:', cssFiles.length, 'caractères');
    
    // Collecter tous les JS
    const jsFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.js'))
      .map(([_, content]) => content)
      .join('\n');

    console.log('📦 JS collecté:', jsFiles.length, 'caractères');

    // Vérifier si c'est un projet React/TypeScript
    const isReactProject = Object.keys(projectFiles).some(path => 
      path.endsWith('.tsx') || path.endsWith('.jsx') || path.includes('App.tsx') || path.includes('main.tsx')
    );
    
    console.log('📦 Type de projet:', isReactProject ? 'React/TypeScript' : 'HTML statique');
    
    // Trouver le fichier HTML demandé
    let htmlContent = '';
    const htmlFile = Object.entries(projectFiles).find(([path]) => 
      path === currentFile || path.endsWith('/' + currentFile)
    );
    
    if (htmlFile) {
      console.log('✅ Fichier HTML trouvé:', htmlFile[0]);
      htmlContent = htmlFile[1];
    } else if (isReactProject) {
      console.error('❌ PROBLÈME: Projet React détecté mais CustomIframePreview ne peut pas compiler React!');
      return '<html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:red">❌ Erreur: Ce composant ne peut pas afficher des projets React. Utilisez VitePreview ou BabelPreview.</div></body></html>';
    } else {
      console.log('⚠️ Aucun fichier HTML, création d\'un template de base');
      // Créer un HTML de base
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

    // Injecter les CSS et le script d'inspection DIRECTEMENT dans le HTML
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
        console.log('🚀 Magellan Inspect: Script chargé');
        
        let isInspectMode = false;
        let hoveredElement = null;
        
        function init() {
          console.log('🔍 Magellan Inspect: Initialisation');
          
          // Écouter les messages du parent
          window.addEventListener('message', (e) => {
            console.log('📨 Message reçu dans iframe:', e.data);
            if (e.data.type === 'toggle-inspect') {
              isInspectMode = e.data.enabled;
              console.log('🎯 Mode inspect changé:', isInspectMode);
              
              if (isInspectMode) {
                activateInspection();
              } else {
                deactivateInspection();
              }
            }
          });
          
          console.log('✅ Event listener installé');
        }
        
        function activateInspection() {
          console.log('✅ Activation du mode inspection');
          document.body.style.cursor = 'crosshair';
          showAllOutlines();
        }
        
        function deactivateInspection() {
          console.log('❌ Désactivation du mode inspection');
          document.body.style.cursor = 'default';
          if (hoveredElement) {
            hoveredElement.classList.remove('magellan-inspect-highlight');
            hoveredElement.removeAttribute('data-magellan-tag');
            hoveredElement = null;
          }
          hideAllOutlines();
        }
        
        function showAllOutlines() {
          console.log('👁️ Affichage des outlines');
          const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
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
        
        function getElementDescription(el) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'h1') return 'Titre H1';
          if (tag === 'h2') return 'Titre H2';
          if (tag === 'h3') return 'Titre H3';
          if (tag === 'h4') return 'Titre H4';
          if (tag === 'h5') return 'Titre H5';
          if (tag === 'h6') return 'Titre H6';
          if (tag === 'img') return 'Image';
          if (tag === 'button') return 'Bouton';
          if (tag === 'a') return 'Lien';
          if (tag === 'p') return 'Paragraphe';
          if (tag === 'span') return 'Span';
          if (tag === 'input') return 'Input';
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
        
        // Détection des éléments au survol avec mousemove (plus réactif que mouseover)
        document.addEventListener('mousemove', (e) => {
          if (!isInspectMode) return;
          
          const target = e.target;
          if (target === hoveredElement) return; // Même élément, ne rien faire
          if (target === document.body || target === document.documentElement) return;
          
          // Filtrer les éléments sélectionnables
          const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
          if (!selectableTags.includes(target.tagName)) return;
          
          // Retirer le highlight précédent
          if (hoveredElement) {
            hoveredElement.classList.remove('magellan-inspect-highlight');
            hoveredElement.removeAttribute('data-magellan-tag');
          }
          
          // Ajouter le nouveau highlight
          hoveredElement = target;
          const elementType = getElementDescription(target);
          target.setAttribute('data-magellan-tag', elementType);
          target.classList.add('magellan-inspect-highlight');
        }, true);
        
        // Sélection au clic
        document.addEventListener('click', (e) => {
          if (!isInspectMode) return;
          
          // Arrêter la propagation pour éviter les conflits
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const target = e.target;
          if (target === document.body || target === document.documentElement) return;
          
          console.log('🎯 Élément cliqué:', target.tagName);
          
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
          
          console.log('📤 Envoi des infos au parent:', elementInfo);
          window.parent.postMessage({
            type: 'element-selected',
            data: elementInfo
          }, '*');
          
          return false;
        }, true);
        
        // Intercepter les clics sur liens (APRÈS le click handler d'inspection)
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href && !isInspectMode) {
            const href = target.getAttribute('href') || '';
            
            // Bloquer liens externes
            if (href.startsWith('http') || href.startsWith('//') || href.includes('magellan') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              e.preventDefault();
              e.stopPropagation();
              
              const errorDiv = document.createElement('div');
              errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#000;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;max-width:400px;text-align:center;font-family:system-ui;';
              errorDiv.innerHTML = '<h3 style="margin:0 0 1rem 0;font-size:1.25rem;color:#dc2626;">🚫 Lien externe bloqué</h3>' +
                '<p style="margin:0 0 1rem 0;color:#666;">Les liens externes sont désactivés dans la preview.</p>' +
                '<button onclick="this.parentElement.remove()" style="background:rgb(3,165,192);color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:9999px;cursor:pointer;font-size:1rem;font-weight:500;">Fermer</button>';
              document.body.appendChild(errorDiv);
              setTimeout(() => errorDiv.remove(), 3000);
              return false;
            }
            
            // Ancres
            if (href.startsWith('#')) {
              return true;
            }
            
            // Navigation multi-pages
            const pathname = href.replace(/^\//, '');
            if (pathname && pathname !== '' && pathname !== '/') {
              e.preventDefault();
              e.stopPropagation();
              
              window.parent.postMessage({
                type: 'navigate',
                file: pathname
              }, '*');
              return false;
            }
          }
        });
        
        // Attendre que le DOM soit prêt avant d'initialiser
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      })();
    </script>
    `;

    // Injecter CSS et JS dans le HTML
    let finalHTML = htmlContent;
    
    // ❌ RETIRER TOUTES LES RÉFÉRENCES EXTERNES AUX FICHIERS CSS/JS
    console.log('🗑️ Suppression des références externes CSS/JS');
    
    // Retirer les liens CSS externes
    finalHTML = finalHTML.replace(/<link[^>]*href=["'][^"']*\.css["'][^>]*>/gi, '');
    
    // Retirer les scripts externes
    finalHTML = finalHTML.replace(/<script[^>]*src=["'][^"']*\.js["'][^>]*><\/script>/gi, '');
    
    console.log('✅ Références externes supprimées');
    
    // ✅ AJOUTER LE CSS DANS LE <HEAD>
    if (cssFiles) {
      console.log('✅ Injection CSS inline dans <head>');
      const styleTag = `<style>${cssFiles}</style>`;
      if (finalHTML.includes('</head>')) {
        finalHTML = finalHTML.replace('</head>', `${styleTag}</head>`);
      } else {
        finalHTML = finalHTML.replace('<head>', `<head>${styleTag}`);
      }
    } else {
      console.warn('⚠️ Aucun CSS à injecter');
    }
    
    // ✅ AJOUTER LE JAVASCRIPT INLINE AVANT LE SCRIPT D'INSPECTION
    if (jsFiles) {
      console.log('✅ Injection JS inline dans <body>');
      // Échapper les balises </script> dans le code JavaScript pour éviter la fermeture prématurée
      const escapedJS = jsFiles.replace(/<\/script>/gi, '<\\/script>');
      const scriptTag = `<script>${escapedJS}</script>`;
      if (finalHTML.includes('</body>')) {
        finalHTML = finalHTML.replace('</body>', `${scriptTag}${inspectionScript}</body>`);
      } else {
        finalHTML += scriptTag + inspectionScript;
      }
    } else {
      console.warn('⚠️ Aucun JS à injecter');
      // Ajouter quand même le script d'inspection
      if (finalHTML.includes('</body>')) {
        finalHTML = finalHTML.replace('</body>', `${inspectionScript}</body>`);
      } else {
        finalHTML += inspectionScript;
      }
    }

    return finalHTML;
  }, [projectFiles, currentFile]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
      
      // Gérer la navigation multi-pages
      if (event.data.type === 'navigate') {
        const filename = event.data.file;
        console.log('🔄 Navigation vers:', filename);
        
        // Vérifier si le fichier existe
        const fileExists = Object.keys(projectFiles).some(path => 
          path === filename || path.endsWith('/' + filename)
        );
        
        if (fileExists) {
          setCurrentFile(filename);
        } else {
          console.error('❌ Fichier non trouvé:', filename);
          // Afficher la page 404
          setCurrentFile('__404__');
        }
      }
      
      // Gérer le rechargement de la preview
      if (event.data.type === 'reload') {
        console.log('🔄 Rechargement de la preview...');
        setReloadKey(prev => prev + 1);
      }
      // Gérer le rechargement de la preview
      if (event.data.type === 'reload') {
        console.log('🔄 Rechargement de la preview...');
        setReloadKey(prev => prev + 1);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, projectFiles]);

  // Référence pour garder l'état précédent du HTML
  const previousGeneratedHTMLRef = useRef<string>('');
  
  // Fonction centralisée pour envoyer le mode inspect
  const sendInspectModeToIframe = useCallback((retryCount = 0) => {
    if (!iframeRef.current?.contentWindow) {
      console.log('❌ Iframe contentWindow non disponible (tentative', retryCount + 1, ')');
      return;
    }
    
    console.log('✅ Envoi du message toggle-inspect avec enabled:', inspectMode, '(tentative', retryCount + 1, ')');
    iframeRef.current.contentWindow.postMessage({
      type: 'toggle-inspect',
      enabled: inspectMode
    }, '*');
  }, [inspectMode]);

  // Mettre à jour l'iframe quand le HTML change
  useEffect(() => {
    if (!iframeRef.current) return;
    
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    // Vérifier si le HTML a vraiment changé
    const htmlChanged = previousGeneratedHTMLRef.current !== generatedHTML;
    previousGeneratedHTMLRef.current = generatedHTML;
    
    if (htmlChanged) {
      console.log('🔄 HTML changé, rechargement de l\'iframe...');
      doc.open();
      doc.write(generatedHTML);
      doc.close();
      
      // Attendre que l'iframe soit complètement chargée avant de réappliquer le mode inspect
      const iframe = iframeRef.current;
      const handleLoad = () => {
        console.log('✅ Iframe chargée, réapplication du mode inspect:', inspectMode);
        
        // Envoyer avec plusieurs tentatives espacées
        sendInspectModeToIframe(0);
        setTimeout(() => sendInspectModeToIframe(1), 100);
        setTimeout(() => sendInspectModeToIframe(2), 300);
        setTimeout(() => sendInspectModeToIframe(3), 600);
      };
      
      iframe.addEventListener('load', handleLoad, { once: true });
      
      // Fallback si l'événement load ne se déclenche pas
      setTimeout(handleLoad, 800);
    }
  }, [generatedHTML, reloadKey, sendInspectModeToIframe]);

  // Envoyer l'état d'inspection à l'iframe quand inspectMode change
  useEffect(() => {
    console.log('📤 Mode inspection changé:', inspectMode);
    
    // Envoyer avec plusieurs tentatives pour être sûr
    sendInspectModeToIframe(0);
    const timer1 = setTimeout(() => sendInspectModeToIframe(1), 50);
    const timer2 = setTimeout(() => sendInspectModeToIframe(2), 150);
    const timer3 = setTimeout(() => sendInspectModeToIframe(3), 400);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [inspectMode, sendInspectModeToIframe]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Preview"
    />
  );
}
