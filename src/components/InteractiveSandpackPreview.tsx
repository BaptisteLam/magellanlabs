import { useState, useRef, useCallback, useEffect } from 'react';
import { SandpackPreview } from './SandpackPreview';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Trouver l'iframe Sandpack dans le DOM
  useEffect(() => {
    if (!containerRef.current) return;
    
    const findIframe = () => {
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe) {
        iframeRef.current = iframe;
      }
    };

    // Observer les changements DOM pour trouver l'iframe
    const observer = new MutationObserver(findIframe);
    observer.observe(containerRef.current, { childList: true, subtree: true });
    findIframe();

    return () => observer.disconnect();
  }, []);

  // Gérer le mode inspection avec overlay
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
    if (!inspectMode || !iframeRef.current) return;

    try {
      const iframe = iframeRef.current;
      const iframeRect = iframe.getBoundingClientRect();
      const x = e.clientX - iframeRect.left;
      const y = e.clientY - iframeRect.top;

      // Note: À cause des restrictions cross-origin de Sandpack,
      // on ne peut pas accéder directement au DOM de l'iframe.
      // On utilise postMessage pour communiquer avec le preview.
      iframe.contentWindow?.postMessage({
        type: 'inspect-hover',
        x,
        y
      }, '*');
    } catch (error) {
      // Erreur cross-origin silencieuse
    }
  }, [inspectMode]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (!inspectMode || !iframeRef.current) return;

    try {
      const iframe = iframeRef.current;
      const iframeRect = iframe.getBoundingClientRect();
      const x = e.clientX - iframeRect.left;
      const y = e.clientY - iframeRect.top;

      // Simuler une sélection basique avec les coordonnées
      const mockElement: ElementInfo = {
        tagName: 'div',
        textContent: '',
        classList: [],
        path: `element-at-${Math.round(x)}-${Math.round(y)}`,
        innerHTML: '',
        boundingRect: {
          left: e.clientX - 50,
          top: e.clientY - 20,
          width: 100,
          height: 40,
          bottom: e.clientY + 20,
          right: e.clientX + 50
        }
      };

      setSelectedElement(mockElement);
      setShowEditBar(true);
      onInspectModeChange?.(false);
    } catch (error) {
      console.error('Error selecting element:', error);
    }
  }, [inspectMode, onInspectModeChange]);

  // Écouter les messages de l'iframe Sandpack
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'inspect-element-selected') {
        const elementInfo: ElementInfo = event.data.elementInfo;
        setSelectedElement(elementInfo);
        setShowEditBar(true);
        onInspectModeChange?.(false);
      }
      if (event.data?.type === 'inspect-element-hovered') {
        setHoveredElement(event.data.elementInfo);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onInspectModeChange]);

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
      {/* Preview Sandpack */}
      <SandpackPreview 
        projectFiles={projectFiles}
        previewMode={previewMode}
      />

      {/* Overlay pour le mode inspection */}
      {inspectMode && (
        <div
          className="absolute inset-0 cursor-crosshair z-10"
          style={{ backgroundColor: 'rgba(3, 165, 192, 0.05)' }}
          onMouseMove={handleOverlayMouseMove}
          onClick={handleOverlayClick}
        >
          {/* Indicateur de mode inspection */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'rgba(3, 165, 192, 0.1)',
              border: '1px solid #03A5C0',
              color: '#03A5C0'
            }}
          >
            Mode inspection actif - Cliquez sur un élément
          </div>

          {/* Outline de l'élément survolé */}
          {hoveredElement?.boundingRect && (
            <div
              className="absolute pointer-events-none border-2 border-dashed"
              style={{
                left: hoveredElement.boundingRect.left,
                top: hoveredElement.boundingRect.top,
                width: hoveredElement.boundingRect.width,
                height: hoveredElement.boundingRect.height,
                borderColor: '#03A5C0',
                backgroundColor: 'rgba(3, 165, 192, 0.1)'
              }}
            />
          )}
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
