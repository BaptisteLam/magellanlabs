import { useState, useRef, useCallback, useEffect } from 'react';
import { SandpackPreview, SandpackPreviewHandle } from './SandpackPreview';
import { EnhancedEditToolbar } from './EnhancedEditToolbar';
import { ArrowUp, ArrowDown, MousePointer2 } from 'lucide-react';

export interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
  elementType?: string;
  isInteractive?: boolean;
  parentTree?: Array<{
    tagName: string;
    id?: string;
    classList: string[];
    isSemanticParent?: boolean;
  }>;
  semanticParent?: {
    tagName: string;
    id?: string;
    classList: string[];
  } | null;
  computedStyles?: {
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    display: string;
    position: string;
    padding: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
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
        
      case 'inspect-escape':
        // L'utilisateur a appuyé sur Escape dans l'iframe
        onInspectModeChange?.(false);
        setHoveredElement(null);
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
  
  // Sélectionner un élément du parent tree
  const handleSelectParent = useCallback((parentIndex: number) => {
    if (!selectedElement?.parentTree || !iframeRef.current) return;
    
    // Envoyer un message à l'iframe pour sélectionner le parent
    iframeRef.current.contentWindow?.postMessage({
      type: 'select-parent',
      parentIndex
    }, '*');
  }, [selectedElement]);

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
            className="px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-3"
            style={{
              backgroundColor: 'rgba(3, 165, 192, 0.15)',
              border: '1px solid #03A5C0',
              color: '#03A5C0',
              backdropFilter: 'blur(8px)'
            }}
          >
            <MousePointer2 className="w-4 h-4" />
            <span>
              {inspectorReady 
                ? 'Cliquez sur un élément • Shift+Clic = parent • ↑↓ = naviguer'
                : 'Chargement...'
              }
            </span>
          </div>
        </div>
      )}

      {/* Outline de l'élément survolé avec label et dimensions */}
      {inspectMode && hoveredElement?.boundingRect && (
        <div
          className="fixed pointer-events-none z-10"
          style={{
            left: hoveredElement.boundingRect.left,
            top: hoveredElement.boundingRect.top,
            width: hoveredElement.boundingRect.width,
            height: hoveredElement.boundingRect.height,
            border: '2px solid #03A5C0',
            backgroundColor: 'rgba(3, 165, 192, 0.08)',
            borderRadius: '4px',
            boxShadow: '0 0 0 1px rgba(3, 165, 192, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Label avec type d'élément */}
          <div 
            className="absolute left-0 px-2 py-1 text-xs font-mono rounded flex items-center gap-1.5"
            style={{
              backgroundColor: '#03A5C0',
              color: 'white',
              top: hoveredElement.boundingRect.top < 30 ? hoveredElement.boundingRect.height + 4 : -28,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
          >
            <span>{hoveredElement.elementType || `<${hoveredElement.tagName}>`}</span>
            {hoveredElement.classList.length > 0 && (
              <span className="opacity-70">.{hoveredElement.classList[0]}</span>
            )}
          </div>
          
          {/* Dimensions */}
          <div 
            className="absolute right-0 px-1.5 py-0.5 text-[10px] font-mono rounded"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: 'white',
              bottom: -20,
            }}
          >
            {Math.round(hoveredElement.boundingRect.width)} × {Math.round(hoveredElement.boundingRect.height)}
          </div>
        </div>
      )}

      {/* Barre d'édition améliorée */}
      <EnhancedEditToolbar
        isOpen={showEditBar}
        onClose={handleCloseEditBar}
        elementInfo={selectedElement}
        onModify={handleModify}
        onSelectParent={handleSelectParent}
      />
    </div>
  );
}

export default InteractiveSandpackPreview;
