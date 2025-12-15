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

// Détecter si c'est un projet React (avec .tsx/.jsx ou react dans package.json)
function isReactProject(files: Record<string, string>): boolean {
  const fileKeys = Object.keys(files);
  
  // Vérifier si des fichiers React existent
  const hasReactFiles = fileKeys.some(f => 
    f.endsWith('.tsx') || f.endsWith('.jsx')
  );
  
  // Vérifier package.json pour react
  const packageJson = files['package.json'] || files['/package.json'];
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        return true;
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }
  
  return hasReactFiles;
}

// Détecter si c'est un projet HTML statique simple
function isStaticHTMLProject(files: Record<string, string>): boolean {
  const fileKeys = Object.keys(files);
  const htmlFiles = fileKeys.filter(f => f.endsWith('.html'));
  const cssFiles = fileKeys.filter(f => f.endsWith('.css'));
  const jsFiles = fileKeys.filter(f => f.endsWith('.js'));
  
  // C'est un projet HTML statique si on a des fichiers HTML/CSS/JS sans React
  return htmlFiles.length > 0 && !isReactProject(files);
}

export function InteractivePreview({ 
  projectFiles, 
  isDark = false, 
  onElementModify, 
  inspectMode, 
  onInspectModeChange 
}: InteractivePreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Détecter le type de projet
  const useStaticPreview = useMemo(() => isStaticHTMLProject(projectFiles), [projectFiles]);

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
            Cliquez sur un élément pour le modifier
          </p>
        </div>
      )}

      {/* Preview selon le type de projet */}
      {useStaticPreview ? (
        <HotReloadableIframe 
          projectFiles={normalizedFiles} 
          isDark={isDark}
          inspectMode={inspectMode}
          onElementSelect={handleElementSelect}
        />
      ) : (
        <SandpackHotReload 
          files={normalizedFiles} 
          isDark={isDark}
          inspectMode={inspectMode}
          onElementSelect={handleElementSelect}
        />
      )}

      {/* Barre de prompt volante */}
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
