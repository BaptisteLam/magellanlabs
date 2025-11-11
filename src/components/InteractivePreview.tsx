import { useState, useRef, useEffect } from 'react';
import { VitePreview } from './VitePreview';
import { ElementEditDialog } from './ElementEditDialog';

interface InteractivePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
  inspectMode: boolean;
  onInspectModeChange: (mode: boolean) => void;
}

export interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
}

export function InteractivePreview({ projectFiles, isDark = false, onElementModify, inspectMode, onInspectModeChange }: InteractivePreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Injecter le script d'inspection dans l'iframe
  useEffect(() => {
    if (!inspectMode) return;

    const injectInspectScript = () => {
      const iframe = document.querySelector('iframe');
      if (!iframe?.contentWindow) return;

      const script = iframe.contentDocument?.createElement('script');
      if (!script) return;

      script.textContent = `
        (function() {
          let currentHighlight = null;
          
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
            e.stopPropagation();
            if (e.target.style) {
              e.target.style.outline = '';
              e.target.style.cursor = '';
            }
          };

          const handleClick = (e) => {
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
            
            // Désactiver le mode inspection après sélection
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

      iframe.contentDocument?.body.appendChild(script);
    };

    // Attendre que l'iframe soit chargée
    const checkIframe = setInterval(() => {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentDocument?.body) {
        injectInspectScript();
        clearInterval(checkIframe);
      }
    }, 500);

    return () => clearInterval(checkIframe);
  }, [inspectMode]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected') {
        setSelectedElement(event.data.data);
        setShowEditDialog(true);
        onInspectModeChange(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleModify = (prompt: string) => {
    if (selectedElement && onElementModify) {
      onElementModify(prompt, selectedElement);
    }
    setShowEditDialog(false);
    setSelectedElement(null);
  };

  return (
    <div className="relative w-full h-full">
      {/* Overlay d'aide en mode inspection */}
      {inspectMode && (
        <div className="absolute top-16 right-4 z-10 bg-background border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="text-sm text-muted-foreground">
            Cliquez sur un élément de la page pour le modifier
          </p>
        </div>
      )}

      {/* Preview Sandpack */}
      <VitePreview 
        projectFiles={projectFiles} 
        isDark={isDark}
      />

      {/* Dialog de modification */}
      <ElementEditDialog
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedElement(null);
        }}
        elementInfo={selectedElement}
        onModify={handleModify}
      />
    </div>
  );
}
