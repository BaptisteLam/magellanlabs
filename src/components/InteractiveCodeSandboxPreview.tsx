import { useState, useRef, useCallback, useEffect } from 'react';
import { CodeSandboxPreview, CodeSandboxPreviewHandle } from './CodeSandboxPreview';
import { LocalInspectablePreview, LocalInspectablePreviewHandle } from './LocalInspectablePreview';
import { EnhancedEditToolbar } from './EnhancedEditToolbar';
import { MousePointer2 } from 'lucide-react';
import type { ElementInfo } from '@/types/elementInfo';

// Re-export ElementInfo pour la compatibilité
export type { ElementInfo };

interface InteractiveCodeSandboxPreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  inspectMode?: boolean;
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
}

export function InteractiveCodeSandboxPreview({
  projectFiles,
  previewMode = 'desktop',
  inspectMode = false,
  onInspectModeChange,
  onElementModify,
}: InteractiveCodeSandboxPreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditBar, setShowEditBar] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<ElementInfo | null>(null);
  const [inspectorReady, setInspectorReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const localPreviewRef = useRef<LocalInspectablePreviewHandle>(null);
  const codesandboxRef = useRef<CodeSandboxPreviewHandle>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Gérer les messages de l'inspector (LocalInspectablePreview)
  const handleInspectorMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'inspector-ready':
        console.log('[InteractiveCodeSandboxPreview] Inspector ready');
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
        onInspectModeChange?.(false);
        setHoveredElement(null);
        break;
    }
  }, [onInspectModeChange]);

  // Activer/désactiver le mode inspection
  useEffect(() => {
    if (inspectMode && localPreviewRef.current) {
      localPreviewRef.current.setInspectMode(true);
    } else if (!inspectMode && localPreviewRef.current) {
      localPreviewRef.current.setInspectMode(false);
      setHoveredElement(null);
      setInspectorReady(false);
    }
  }, [inspectMode]);

  // Callback quand l'iframe locale est prête
  const handleLocalIframeReady = useCallback((iframe: HTMLIFrameElement) => {
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
    
    iframeRef.current.contentWindow?.postMessage({
      type: 'select-parent',
      parentIndex
    }, '*');
  }, [selectedElement]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Mode inspection activé = utiliser LocalInspectablePreview (srcdoc) */}
      {inspectMode ? (
        <LocalInspectablePreview
          ref={localPreviewRef}
          projectFiles={projectFiles}
          previewMode={previewMode}
          onInspectorMessage={handleInspectorMessage}
          onIframeReady={handleLocalIframeReady}
        />
      ) : (
        /* Mode normal = utiliser CodeSandbox embed */
        <CodeSandboxPreview
          ref={codesandboxRef}
          projectFiles={projectFiles}
          previewMode={previewMode}
        />
      )}

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
                ? 'Cliquez sur un élément • Shift+Clic = parent • Escape = quitter'
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

export default InteractiveCodeSandboxPreview;
