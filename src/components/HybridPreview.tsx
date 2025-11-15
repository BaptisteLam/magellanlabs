import { useMemo, useState, useEffect } from 'react';
import { VitePreview } from './VitePreview';
import { CustomIframePreview } from './CustomIframePreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Composant hybride qui choisit automatiquement le bon moteur de preview :
 * - VitePreview (Sandpack) pour les projets React/TypeScript
 * - CustomIframePreview pour les projets HTML statiques
 */
export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);

  // Normaliser les fichiers au format approprié
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      normalized[path] = typeof content === 'string' ? content : content.code;
    }
    return normalized;
  }, [projectFiles]);

  // Détecter le type de projet
  const projectType = useMemo(() => {
    const files = Object.keys(projectFiles);
    
    const hasReactFiles = files.some(path => 
      path.endsWith('.tsx') || 
      path.endsWith('.jsx') || 
      path.includes('App.tsx') || 
      path.includes('main.tsx') ||
      path.includes('package.json')
    );
    
    console.log('🔍 HybridPreview - Type de projet détecté:', hasReactFiles ? 'React' : 'HTML statique');
    console.log('🔍 HybridPreview - Fichiers:', files);
    
    return hasReactFiles ? 'react' : 'static';
  }, [projectFiles]);

  // Injecter le script d'inspection dans VitePreview (Sandpack iframe)
  useEffect(() => {
    if (projectType !== 'react' || !inspectMode) return;

    const injectInspectScript = () => {
      const iframe = document.querySelector('iframe[title="Sandpack Preview"]') as HTMLIFrameElement;
      if (!iframe?.contentWindow?.document) return;

      const existingScript = iframe.contentWindow.document.querySelector('#inspect-script');
      if (existingScript) return; // Déjà injecté

      const script = iframe.contentWindow.document.createElement('script');
      if (!script) return;

      script.id = 'inspect-script';
      script.textContent = `
        (function() {
          let currentHighlight = null;
          let inspectMode = true;
          
          const getElementPath = (element) => {
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
          };

          const handleMouseOver = (e) => {
            if (!inspectMode) return;
            e.stopPropagation();
            if (currentHighlight) {
              currentHighlight.style.outline = '';
              currentHighlight.style.cursor = '';
            }
            currentHighlight = e.target;
            e.target.style.outline = '2px solid #03A5C0';
            e.target.style.cursor = 'pointer';
          };

          const handleMouseOut = (e) => {
            if (!inspectMode) return;
            e.stopPropagation();
            if (e.target.style) {
              e.target.style.outline = '';
              e.target.style.cursor = '';
            }
          };

          const handleClick = (e) => {
            if (!inspectMode) return;
            e.preventDefault();
            e.stopPropagation();
            
            const element = e.target;
            const elementInfo = {
              tagName: element.tagName,
              textContent: element.textContent?.trim() || '',
              classList: Array.from(element.classList || []),
              path: getElementPath(element),
              innerHTML: element.innerHTML,
              id: element.id || undefined
            };
            
            window.parent.postMessage({
              type: 'element-selected',
              data: elementInfo
            }, '*');
            
            // Désactiver temporairement
            inspectMode = false;
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('mouseout', handleMouseOut, true);
            document.removeEventListener('click', handleClick, true);
            
            if (currentHighlight) {
              currentHighlight.style.outline = '';
              currentHighlight.style.cursor = '';
            }
          };

          document.addEventListener('mouseover', handleMouseOver, true);
          document.addEventListener('mouseout', handleMouseOut, true);
          document.addEventListener('click', handleClick, true);
        })();
      `;

      iframe.contentWindow.document.body.appendChild(script);
      console.log('✅ Script d\'inspection injecté dans Sandpack');
    };

    // Attendre que Sandpack soit chargé
    const checkInterval = setInterval(() => {
      const iframe = document.querySelector('iframe[title="Sandpack Preview"]') as HTMLIFrameElement;
      if (iframe?.contentWindow?.document?.body) {
        injectInspectScript();
        clearInterval(checkInterval);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [inspectMode, projectType, projectFiles]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected' && onElementSelect) {
        console.log('✅ Élément sélectionné:', event.data.data);
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Rendu conditionnel selon le type de projet
  if (projectType === 'react') {
    console.log('🎨 Utilisation de VitePreview (Sandpack) pour React');
    return (
      <VitePreview 
        projectFiles={projectFiles} 
        isDark={isDark}
      />
    );
  } else {
    console.log('🎨 Utilisation de CustomIframePreview pour HTML statique');
    return (
      <CustomIframePreview 
        projectFiles={normalizedFiles} 
        isDark={isDark}
        inspectMode={inspectMode}
        onElementSelect={onElementSelect}
      />
    );
  }
}
