import { useState, useMemo } from 'react';
import { HotReloadableIframe } from './HotReloadableIframe';
import { SandpackHotReload } from './SandpackHotReload';
import { FloatingEditBar } from './FloatingEditBar';
import { type ElementInfo } from './InspectOverlay';

interface InteractivePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
  inspectMode: boolean;
  onInspectModeChange: (mode: boolean) => void;
}

export type { ElementInfo };

// FORCE TOUJOURS LE MODE REACT - Utilise Sandpack dans tous les cas
function isReactProject(files: Record<string, string>): boolean {
  // Toujours retourner true pour forcer l'utilisation de Sandpack
  return true;
}

export function InteractivePreview({ projectFiles, isDark = false, onElementModify, inspectMode, onInspectModeChange }: InteractivePreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Détecter le type de projet
  const isReact = useMemo(() => isReactProject(projectFiles), [projectFiles]);

  // Normaliser les fichiers avec stabilisation pour éviter les re-renders inutiles
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    Object.entries(projectFiles).forEach(([path, content]) => {
      normalized[path] = content;
    });
    return normalized;
  }, [JSON.stringify(Object.keys(projectFiles).sort()), ...Object.values(projectFiles)]);

  // Gérer la sélection d'élément
  const handleElementSelect = (elementInfo: ElementInfo) => {
    setSelectedElement(elementInfo);
    setShowEditDialog(true);
    onInspectModeChange(false);
  };

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

      {/* Preview selon le type de projet */}
      {isReact ? (
        <SandpackHotReload 
          files={normalizedFiles} 
          isDark={isDark}
        />
      ) : (
        <HotReloadableIframe 
          projectFiles={normalizedFiles} 
          isDark={isDark}
          inspectMode={inspectMode}
          onElementSelect={handleElementSelect}
        />
      )}

      {/* Barre de prompt volante basique */}
      <FloatingEditBar
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
