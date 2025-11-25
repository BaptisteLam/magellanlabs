import { useState, useEffect, useMemo } from 'react';
import { HybridPreview } from './HybridPreview';
import { VisualEditToolbar } from './VisualEditToolbar';

interface InteractivePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
  inspectMode: boolean;
  onInspectModeChange: (mode: boolean) => void;
  projectType?: 'website' | 'webapp' | 'mobile';
}

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

export function InteractivePreview({ projectFiles, isDark = false, onElementModify, inspectMode, onInspectModeChange, projectType = 'webapp' }: InteractivePreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Normaliser les fichiers
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    Object.entries(projectFiles).forEach(([path, content]) => {
      normalized[path] = content;
    });
    return normalized;
  }, [projectFiles]);

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

      {/* Preview Hybride (React ou HTML statique) */}
      <HybridPreview 
        projectFiles={normalizedFiles} 
        isDark={isDark}
        inspectMode={inspectMode}
        onElementSelect={handleElementSelect}
        projectType={projectType}
      />

      {/* Barre d'édition visuelle avancée */}
      <VisualEditToolbar
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedElement(null);
        }}
        elementInfo={selectedElement}
        onModify={handleModify}
        onDirectEdit={(action, value) => {
          // Pour l'instant, on convertit les actions directes en prompts
          // Dans une version future, on pourrait appliquer les changements directement
          const prompts = {
            color: `Changer la couleur en ${value}`,
            font: `Modifier la police de caractères`,
            edit: `Rendre ce texte éditable`,
            delete: `Supprimer cet élément`
          };
          if (selectedElement && onElementModify) {
            onElementModify(prompts[action], selectedElement);
          }
          setShowEditDialog(false);
          setSelectedElement(null);
        }}
      />
    </div>
  );
}
