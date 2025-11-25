import { useMemo, useEffect, useRef, useState } from 'react';

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

  // Générer le HTML complet avec script d'inspection intégré
  const generatedHTML = useMemo(() => {
    console.log('📦 CustomIframePreview - currentFile:', currentFile);
    console.log('📦 CustomIframePreview - projectFiles:', Object.keys(projectFiles));
    
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
    <script>
      let inspectMode = false;
      let currentHighlight = null;
      
      // Intercepter TOUS les clics sur liens pour isoler la preview
      document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href) {
          const href = target.getAttribute('href') || '';
          
          // Bloquer TOUS les liens externes et magellan
          if (href.startsWith('http') || href.startsWith('//') || href.includes('magellan') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            e.preventDefault();
            e.stopPropagation();
            
            // Afficher message d'erreur
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#000;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;max-width:400px;text-align:center;font-family:system-ui;';
            errorDiv.innerHTML = \`
              <h3 style="margin:0 0 1rem 0;font-size:1.25rem;color:#dc2626;">🚫 Lien externe bloqué</h3>
              <p style="margin:0 0 1rem 0;color:#666;">Les liens externes sont désactivés dans la preview.</p>
              <button onclick="this.parentElement.remove()" style="background:rgb(3,165,192);color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:9999px;cursor:pointer;font-size:1rem;font-weight:500;">Fermer</button>
            \`;
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
            return false;
          }
          
          // Pour les ancres (#section)
          if (href.startsWith('#')) {
            // Laisser l'ancre fonctionner
            return true;
          }
          
          // Pour les autres liens internes (navigation multi-pages)
          const pathname = href.replace(/^\//, '');
          if (pathname && pathname !== '' && pathname !== '/') {
            e.preventDefault();
            e.stopPropagation();
            
            // Envoyer un message au parent pour charger le fichier
            window.parent.postMessage({
              type: 'navigate',
              file: pathname
            }, '*');
            return false;
          }
        }
      }, true);
      
      window.addEventListener('message', (e) => {
        console.log('📨 Message reçu dans iframe:', e.data);
        if (e.data.type === 'toggle-inspect') {
          console.log('🔍 Toggle inspect mode:', e.data.enabled);
          inspectMode = e.data.enabled;
          if (inspectMode) {
            console.log('✅ Activation du mode inspection');
            activateInspection();
          } else {
            console.log('❌ Désactivation du mode inspection');
            deactivateInspection();
          }
        }
      });
      
      function activateInspection() {
        console.log('🎯 activateInspection appelée');
        document.body.style.cursor = 'crosshair';
        document.addEventListener('click', handleElementClick, true);
        document.addEventListener('mouseover', highlightElement, true);
        document.addEventListener('mouseout', removeHighlight, true);
        showAllOutlines();
        console.log('✅ Event listeners ajoutés');
      }
      
      function deactivateInspection() {
        document.body.style.cursor = 'default';
        document.removeEventListener('click', handleElementClick, true);
        document.removeEventListener('mouseover', highlightElement, true);
        document.removeEventListener('mouseout', removeHighlight, true);
        hideAllOutlines();
        removeHighlight();
      }
      
      function showAllOutlines() {
        const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
        document.querySelectorAll(selectableTags.join(',')).forEach(el => {
          if (el !== document.body && el !== document.documentElement) {
            el.style.outline = '1px dashed rgba(3, 165, 192, 0.3)';
            el.style.outlineOffset = '2px';
            el.setAttribute('data-inspectable', 'true');
          }
        });
      }
      
      function hideAllOutlines() {
        document.querySelectorAll('[data-inspectable]').forEach(el => {
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.removeAttribute('data-inspectable');
        });
      }
      
      function highlightElement(e) {
        if (!inspectMode) return;
        
        const target = e.target;
        if (target === document.body || target === document.documentElement) return;
        
        // Filtrer les éléments non pertinents
        const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
        if (!selectableTags.includes(target.tagName)) return;
        
        removeHighlight();
        
        // Créer un overlay avec effet de pulsation
        const rect = target.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.id = '__inspect_overlay__';
        overlay.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${rect.top}px;
          width: \${rect.width}px;
          height: \${rect.height}px;
          border: 2px solid #03A5C0;
          border-radius: 4px;
          background: rgba(3, 165, 192, 0.05);
          box-shadow: 0 0 0 4px rgba(3, 165, 192, 0.2);
          pointer-events: none;
          z-index: 999998;
          transition: all 150ms ease-in-out;
          animation: inspectPulse 2s ease-in-out infinite;
        \`;
        
        // Créer le label du tag
        const label = document.createElement('div');
        label.id = '__inspect_label__';
        label.textContent = target.tagName.toLowerCase();
        label.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${rect.top - 24}px;
          background: #03A5C0;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
          font-weight: 600;
          pointer-events: none;
          z-index: 999999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        \`;
        
        // Ajouter animation de pulsation
        const style = document.createElement('style');
        style.id = '__inspect_animation__';
        style.textContent = \`
          @keyframes inspectPulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(3, 165, 192, 0.2); }
            50% { box-shadow: 0 0 0 8px rgba(3, 165, 192, 0.3); }
          }
        \`;
        if (!document.getElementById('__inspect_animation__')) {
          document.head.appendChild(style);
        }
        
        document.body.appendChild(overlay);
        document.body.appendChild(label);
        currentHighlight = target;
      }
      
      function removeHighlight() {
        const overlay = document.getElementById('__inspect_overlay__');
        if (overlay) {
          overlay.remove();
        }
        const label = document.getElementById('__inspect_label__');
        if (label) {
          label.remove();
        }
        if (currentHighlight) {
          currentHighlight = null;
        }
      }
      
      function handleElementClick(e) {
        if (!inspectMode) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target;
        const rect = target.getBoundingClientRect();
        
        window.parent.postMessage({
          type: 'element-selected',
          data: {
            tagName: target.tagName,
            textContent: target.textContent?.substring(0, 200) || '',
            classList: Array.from(target.classList),
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
          }
        }, '*');
      }
      
      function getElementPath(element) {
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          
          if (current.id) {
            selector += '#' + current.id;
          } else if (current.className) {
            const classes = Array.from(current.classList).join('.');
            if (classes) selector += '.' + classes;
          }
          
          path.unshift(selector);
          current = current.parentElement;
        }
        
        return path.join(' > ');
      }
    </script>
    `;

    // Injecter CSS et JS dans le HTML
    let finalHTML = htmlContent;
    
    // ✅ AJOUTER LE CSS DANS LE <HEAD>
    if (cssFiles) {
      console.log('✅ Injection CSS dans <head>');
      const styleTag = `<style>${cssFiles}</style>`;
      if (finalHTML.includes('</head>')) {
        finalHTML = finalHTML.replace('</head>', `${styleTag}</head>`);
      } else {
        finalHTML = finalHTML.replace('<head>', `<head>${styleTag}`);
      }
    } else {
      console.warn('⚠️ Aucun CSS à injecter');
    }
    
    // ✅ AJOUTER LE JAVASCRIPT AVANT LE SCRIPT D'INSPECTION
    if (jsFiles) {
      console.log('✅ Injection JS dans <body>');
      const scriptTag = `<script>${jsFiles}</script>`;
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
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, projectFiles]);

  // Envoyer l'état d'inspection à l'iframe
  useEffect(() => {
    console.log('📤 Envoi du mode inspection:', inspectMode);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'toggle-inspect',
        enabled: inspectMode
      }, '*');
      console.log('✅ Message envoyé');
    } else {
      console.log('❌ Iframe contentWindow non disponible');
    }
  }, [inspectMode]);

  // Mettre à jour l'iframe quand le HTML change
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(generatedHTML);
        doc.close();
        
        // Attendre que l'iframe soit chargée puis réappliquer le mode inspect
        const sendInspectMode = () => {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'toggle-inspect',
              enabled: inspectMode
            }, '*');
          }
        };
        
        // Envoyer le message après un court délai pour s'assurer que le script est chargé
        setTimeout(sendInspectMode, 100);
      }
    }
  }, [generatedHTML, inspectMode]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Preview"
    />
  );
}
