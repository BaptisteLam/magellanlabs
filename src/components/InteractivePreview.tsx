import { useState, useMemo, useEffect } from 'react';
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
    f.endsWith('.tsx') || f.endsWith('.jsx') ||
    f.includes('App.tsx') || f.includes('main.tsx')
  );
  
  // Vérifier package.json pour react
  const packageJson = files['package.json'] || files['/package.json'];
  let hasReactDep = false;
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      hasReactDep = !!(pkg.dependencies?.react || pkg.devDependencies?.react);
    } catch {
      // Ignorer les erreurs de parsing
    }
  }
  
  const result = hasReactFiles || hasReactDep;
  console.log('🔍 isReactProject:', { result, hasReactFiles, hasReactDep, fileCount: fileKeys.length, files: fileKeys.slice(0, 5) });
  return result;
}

// Détecter si c'est un projet HTML statique simple
function isStaticHTMLProject(files: Record<string, string>): boolean {
  const fileKeys = Object.keys(files);
  const htmlFiles = fileKeys.filter(f => f.endsWith('.html'));
  const hasNoReactFiles = !fileKeys.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
  
  // C'est un projet HTML statique si on a des fichiers HTML sans React
  const result = htmlFiles.length > 0 && hasNoReactFiles;
  console.log('🔍 isStaticHTMLProject:', { result, htmlFiles: htmlFiles.length, hasNoReactFiles });
  return result;
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
