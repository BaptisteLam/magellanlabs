import { useState, useRef, useCallback, useEffect } from 'react';
import { SandpackPreview, SandpackPreviewHandle } from './SandpackPreview';
import { FloatingEditBar } from './FloatingEditBar';

export interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
  boundingRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
}

interface InteractiveSandpackPreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  inspectMode?: boolean;
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
}

export function InteractiveSandpackPreview({
  projectFiles,
  previewMode = 'desktop',
  inspectMode = false,
  onInspectModeChange,
  onElementModify,
}: InteractiveSandpackPreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditBar, setShowEditBar] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<ElementInfo | null>(null);
  const [inspectorReady, setInspectorReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sandpackRef = useRef<SandpackPreviewHandle>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gérer les messages de l'inspector injecté dans Sandpack
  const handleInspectorMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'inspector-loaded':
      case 'inspector-ready':
        console.log('[InteractiveSandpackPreview] Inspector ready');
        setInspectorReady(true);
        break;
        
      case 'inspect-element-hover':
        if (data.elementInfo) {
          const iframe = iframeRef.current;
          if (iframe && data.elementInfo.boundingRect) {
            const iframeRect = iframe.getBoundingClientRect();
            setHoveredElement({
              ...data.elementInfo,
              boundingRect: {
                ...data.elementInfo.boundingRect,
                left: data.elementInfo.boundingRect.left + iframeRect.left,
                top: data.elementInfo.boundingRect.top + iframeRect.top,
                right: data.elementInfo.boundingRect.right + iframeRect.left,
                bottom: data.elementInfo.boundingRect.bottom + iframeRect.top,
              }
            });
          } else {
            setHoveredElement(data.elementInfo);
          }
        }
        break;
        
      case 'inspect-element-selected':
        if (data.elementInfo) {
          const iframe = iframeRef.current;
          if (iframe && data.elementInfo.boundingRect) {
            const iframeRect = iframe.getBoundingClientRect();
            const adjustedElement = {
              ...data.elementInfo,
              boundingRect: {
                ...data.elementInfo.boundingRect,
                left: data.elementInfo.boundingRect.left + iframeRect.left,
                top: data.elementInfo.boundingRect.top + iframeRect.top,
                right: data.elementInfo.boundingRect.right + iframeRect.left,
                bottom: data.elementInfo.boundingRect.bottom + iframeRect.top,
              }
            };
            setSelectedElement(adjustedElement);
          } else {
            setSelectedElement(data.elementInfo);
          }
          setShowEditBar(true);
          setHoveredElement(null);
          onInspectModeChange?.(false);
        }
        break;
    }
  }, [onInspectModeChange]);

  // Activer/désactiver le mode inspection avec retry
  useEffect(() => {
    // Nettoyer le timeout précédent
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (inspectMode) {
      // Activer le mode inspection
      const activateInspectMode = () => {
        if (sandpackRef.current) {
          sandpackRef.current.setInspectMode(true);
        }
      };
      
      // Activer immédiatement
      activateInspectMode();
      
      // Si l'inspector n'est pas encore prêt, réessayer
      if (!inspectorReady) {
        const retryInterval = setInterval(() => {
          console.log('[InteractiveSandpackPreview] Retrying inspect mode activation...');
          activateInspectMode();
        }, 500);
        
        // Arrêter après 5 secondes
        retryTimeoutRef.current = setTimeout(() => {
          clearInterval(retryInterval);
        }, 5000);
        
        return () => {
          clearInterval(retryInterval);
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
        };
      }
    } else {
      // Désactiver le mode inspection
      if (sandpackRef.current) {
        sandpackRef.current.setInspectMode(false);
      }
      setHoveredElement(null);
      setInspectorReady(false);
    }
  }, [inspectMode, inspectorReady]);

  // Callback quand l'iframe est prête
  const handleIframeReady = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe;
  }, []);

  const handleModify = useCallback((prompt: string) => {
    if (selectedElement && onElementModify) {
      onElementModify(prompt, selectedElement);
    }
    setShowEditBar(false);
    setSelectedElement(null);
  }, [selectedElement, onElementModify]);

  const handleCloseEditBar = useCallback(() => {
    setShowEditBar(false);
    setSelectedElement(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Preview Sandpack avec inspector activé */}
      <SandpackPreview
        ref={sandpackRef}
        projectFiles={projectFiles}
        previewMode={previewMode}
        enableInspector={inspectMode}
        onIframeReady={handleIframeReady}
        onInspectorMessage={handleInspectorMessage}
      />

      {/* Overlay pour afficher l'indicateur de mode inspection */}
      {inspectMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div 
            className="px-4 py-2 rounded-full text-sm font-medium shadow-lg"
            style={{
              backgroundColor: 'rgba(3, 165, 192, 0.15)',
              border: '1px solid #03A5C0',
              color: '#03A5C0',
              backdropFilter: 'blur(8px)'
            }}
          >
            {inspectorReady 
              ? 'Mode inspection actif - Cliquez sur un élément'
              : 'Chargement de l\'inspecteur...'
            }
          </div>
        </div>
      )}

      {/* Outline de l'élément survolé */}
      {inspectMode && hoveredElement?.boundingRect && (
        <div
          className="fixed pointer-events-none z-10"
          style={{
            left: hoveredElement.boundingRect.left,
            top: hoveredElement.boundingRect.top,
            width: hoveredElement.boundingRect.width,
            height: hoveredElement.boundingRect.height,
            border: '2px dashed #03A5C0',
            backgroundColor: 'rgba(3, 165, 192, 0.1)',
            borderRadius: '4px'
          }}
        >
          <div 
            className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-mono rounded"
            style={{
              backgroundColor: '#03A5C0',
              color: 'white'
            }}
          >
            &lt;{hoveredElement.tagName}&gt;
            {hoveredElement.classList.length > 0 && (
              <span className="opacity-75">.{hoveredElement.classList[0]}</span>
            )}
          </div>
        </div>
      )}

      {/* Barre d'édition flottante */}
      <FloatingEditBar
        isOpen={showEditBar}
        onClose={handleCloseEditBar}
        elementInfo={selectedElement}
        onModify={handleModify}
      />
    </div>
  );
}

export default InteractiveSandpackPreview;
