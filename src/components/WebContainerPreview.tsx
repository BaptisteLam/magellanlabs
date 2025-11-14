import { useEffect, useRef, useMemo } from 'react';

interface WebContainerPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function WebContainerPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Normaliser et compiler les fichiers du projet
  const previewHTML = useMemo(() => {
    console.log('📦 WebContainerPreview - Génération HTML');
    console.log('📁 Fichiers reçus:', Object.keys(projectFiles));

    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return `
        <!DOCTYPE html>
        <html>
          <head><meta charset="UTF-8"></head>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#f8f9fa">
            <div style="text-align:center">
              <div style="font-size:48px;margin-bottom:16px">⏳</div>
              <div style="color:#64748b">En attente du projet...</div>
            </div>
          </body>
        </html>
      `;
    }

    // Normaliser les fichiers
    const normalizedFiles: Record<string, string> = {};
    Object.entries(projectFiles).forEach(([path, content]) => {
      if (typeof content === 'string') {
        normalizedFiles[path] = content;
      } else if (content && typeof content === 'object' && 'code' in content) {
        normalizedFiles[path] = content.code;
      }
    });

    // Chercher le fichier index.html principal
    let mainHTML = '';
    const htmlKeys = Object.keys(normalizedFiles).filter(k => 
      k.endsWith('.html') || k === 'index.html'
    );
    
    if (htmlKeys.length > 0) {
      const mainKey = htmlKeys.find(k => k === 'index.html') || htmlKeys[0];
      mainHTML = normalizedFiles[mainKey];
      console.log('✅ HTML principal trouvé:', mainKey);
    }

    // Collecter tous les CSS
    const cssFiles = Object.entries(normalizedFiles)
      .filter(([path]) => path.endsWith('.css'))
      .map(([_, content]) => content)
      .join('\n');

    // Collecter tous les JS (pour React/JSX on ne peut pas les exécuter directement)
    const hasReactFiles = Object.keys(normalizedFiles).some(k => 
      k.endsWith('.tsx') || k.endsWith('.jsx')
    );

    if (hasReactFiles) {
      console.warn('⚠️ Projet React détecté - Preview HTML statique uniquement');
      return `
        <!DOCTYPE html>
        <html>
          <head><meta charset="UTF-8"></head>
          <body style="display:flex;align-items:center;justify-center;height:100vh;font-family:system-ui;background:#fff">
            <div style="text-align:center;padding:32px">
              <div style="font-size:48px;margin-bottom:16px">⚛️</div>
              <h2 style="color:#334155;margin-bottom:8px">Projet React/TypeScript</h2>
              <p style="color:#64748b">La preview complète nécessite un serveur de build.</p>
              <p style="color:#94a3b8;font-size:14px;margin-top:16px">
                ${Object.keys(normalizedFiles).length} fichiers chargés
              </p>
            </div>
          </body>
        </html>
      `;
    }

    // Si pas de HTML, créer un template minimal
    if (!mainHTML) {
      console.log('📝 Création d\'un template HTML minimal');
      mainHTML = `
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `;
    }

    // Injecter le CSS dans le HTML
    let finalHTML = mainHTML;
    if (cssFiles) {
      const styleTag = `<style>${cssFiles}</style>`;
      if (finalHTML.includes('</head>')) {
        finalHTML = finalHTML.replace('</head>', `${styleTag}</head>`);
      } else {
        finalHTML = finalHTML.replace('<head>', `<head>${styleTag}`);
      }
    }

    // Ajouter le script d'inspection si nécessaire
    const inspectionScript = `
      <script>
        let inspectModeEnabled = false;
        let currentHighlight = null;
        
        window.addEventListener('message', (e) => {
          if (e.data.type === 'toggle-inspect') {
            inspectModeEnabled = e.data.enabled;
            if (inspectModeEnabled) {
              activateInspection();
            } else {
              deactivateInspection();
            }
          }
        });
        
        function activateInspection() {
          document.body.style.cursor = 'crosshair';
          document.addEventListener('click', handleClick, true);
          document.addEventListener('mouseover', highlightElement, true);
          document.addEventListener('mouseout', removeHighlight, true);
        }
        
        function deactivateInspection() {
          document.body.style.cursor = 'default';
          document.removeEventListener('click', handleClick, true);
          document.removeEventListener('mouseover', highlightElement, true);
          document.removeEventListener('mouseout', removeHighlight, true);
          removeHighlight();
        }
        
        function highlightElement(e) {
          if (!inspectModeEnabled) return;
          const target = e.target;
          if (target === document.body || target === document.documentElement) return;
          removeHighlight();
          target.style.outline = '2px solid #03A5C0';
          target.style.outlineOffset = '2px';
          currentHighlight = target;
        }
        
        function removeHighlight() {
          if (currentHighlight) {
            currentHighlight.style.outline = '';
            currentHighlight.style.outlineOffset = '';
            currentHighlight = null;
          }
        }
        
        function handleClick(e) {
          if (!inspectModeEnabled) return;
          e.preventDefault();
          e.stopPropagation();
          const target = e.target;
          window.parent.postMessage({
            type: 'element-selected',
            data: {
              tagName: target.tagName,
              textContent: target.textContent?.substring(0, 200) || '',
              classList: Array.from(target.classList),
              path: getPath(target),
              innerHTML: target.innerHTML,
              id: target.id || undefined
            }
          }, '*');
        }
        
        function getPath(element) {
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

    if (finalHTML.includes('</body>')) {
      finalHTML = finalHTML.replace('</body>', `${inspectionScript}</body>`);
    } else {
      finalHTML += inspectionScript;
    }

    console.log('✅ HTML final généré');
    return finalHTML;
  }, [projectFiles]);

  // Gérer le mode inspection
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'toggle-inspect',
        enabled: inspectMode
      }, '*');
    }
  }, [inspectMode]);

  // Écouter les événements de sélection d'éléments
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={previewHTML}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Preview"
    />
  );
}
