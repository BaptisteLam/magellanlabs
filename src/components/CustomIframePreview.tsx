import { useMemo, useEffect, useRef } from 'react';

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

  // Générer le HTML complet avec script d'inspection intégré
  const generatedHTML = useMemo(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return '<html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">Generating preview...</div></body></html>';
    }

    // Collecter tous les CSS
    const cssFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.css'))
      .map(([_, content]) => content)
      .join('\n');

    // Trouver le fichier HTML principal ou créer un template
    let htmlContent = '';
    const htmlFile = Object.entries(projectFiles).find(([path]) => path.endsWith('.html'));
    
    if (htmlFile) {
      htmlContent = htmlFile[1];
    } else {
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
      
      window.addEventListener('message', (e) => {
        if (e.data.type === 'toggle-inspect') {
          inspectMode = e.data.enabled;
          if (inspectMode) {
            activateInspection();
          } else {
            deactivateInspection();
          }
        }
      });
      
      function activateInspection() {
        document.body.style.cursor = 'crosshair';
        document.addEventListener('click', handleElementClick, true);
        document.addEventListener('mouseover', highlightElement, true);
        document.addEventListener('mouseout', removeHighlight, true);
      }
      
      function deactivateInspection() {
        document.body.style.cursor = 'default';
        document.removeEventListener('click', handleElementClick, true);
        document.removeEventListener('mouseover', highlightElement, true);
        document.removeEventListener('mouseout', removeHighlight, true);
        removeHighlight();
      }
      
      function highlightElement(e) {
        if (!inspectMode) return;
        
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
      
      function handleElementClick(e) {
        if (!inspectMode) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target;
        
        window.parent.postMessage({
          type: 'element-selected',
          data: {
            tagName: target.tagName,
            textContent: target.textContent?.substring(0, 200) || '',
            classList: Array.from(target.classList),
            path: getElementPath(target),
            innerHTML: target.innerHTML,
            id: target.id || undefined
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

    // Injecter CSS et script dans le HTML
    let finalHTML = htmlContent;
    
    // Ajouter les CSS dans le <head>
    if (cssFiles) {
      const styleTag = `<style>${cssFiles}</style>`;
      if (finalHTML.includes('</head>')) {
        finalHTML = finalHTML.replace('</head>', `${styleTag}</head>`);
      } else {
        finalHTML = finalHTML.replace('<head>', `<head>${styleTag}`);
      }
    }
    
    // Ajouter le script d'inspection juste avant </body>
    if (finalHTML.includes('</body>')) {
      finalHTML = finalHTML.replace('</body>', `${inspectionScript}</body>`);
    } else {
      finalHTML += inspectionScript;
    }

    return finalHTML;
  }, [projectFiles]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Envoyer l'état d'inspection à l'iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'toggle-inspect',
        enabled: inspectMode
      }, '*');
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
      }
    }
  }, [generatedHTML]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Preview"
    />
  );
}
