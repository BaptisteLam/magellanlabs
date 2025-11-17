import { useState, useEffect, useMemo } from 'react';
import { HybridPreview } from './HybridPreview';
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

  // Détecter si c'est un projet HTML pur
  const isHtmlProject = useMemo(() => {
    return Object.keys(projectFiles).some(path => 
      path.endsWith('index.html') && 
      !Object.keys(projectFiles).some(p => p.endsWith('.tsx') || p.endsWith('.jsx'))
    );
  }, [projectFiles]);

  // Convertir au format Sandpack
  const convertToSandpackFormat = (files: Record<string, string>) => {
    const sandpackFiles: Record<string, { code: string }> = {};
    
    for (const [path, content] of Object.entries(files)) {
      // Normaliser le chemin pour Sandpack
      let sandpackPath = path;
      
      // Ajouter "/" au début si absent
      if (!sandpackPath.startsWith('/')) {
        sandpackPath = '/' + sandpackPath;
      }
      
      // Format Sandpack : { code: string }
      sandpackFiles[sandpackPath] = {
        code: content
      };
    }
    
    // Vérifier si on a un main.tsx qui importe App.tsx mais pas de App.tsx
    const hasMainTsx = sandpackFiles['/src/main.tsx'] || sandpackFiles['/main.tsx'];
    const hasAppTsx = sandpackFiles['/src/App.tsx'] || sandpackFiles['/App.tsx'];
    
    if (hasMainTsx && !hasAppTsx) {
      console.log('⚠️ main.tsx détecté sans App.tsx - Création automatique de App.tsx');
      
      // Créer un App.tsx par défaut
      sandpackFiles['/src/App.tsx'] = {
        code: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Hello World</h1>
        <button 
          onClick={() => setCount((count) => count + 1)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-full"
        >
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
`
      };
    }
    
    // Ajouter package.json si absent OU le mettre à jour
    const existingPackageJson = sandpackFiles['/package.json'];
    let packageJsonContent = {
      name: 'generated-app',
      version: '1.0.0',
      dependencies: {
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.263.1'
      }
    };

    // Si package.json existe déjà, le parser et ajouter lucide-react
    if (existingPackageJson) {
      try {
        const parsed = JSON.parse(existingPackageJson.code);
        packageJsonContent = {
          ...parsed,
          dependencies: {
            ...parsed.dependencies,
            'lucide-react': '^0.263.1'
          }
        };
      } catch (e) {
        console.error('Error parsing package.json:', e);
      }
    }

    sandpackFiles['/package.json'] = {
      code: JSON.stringify(packageJsonContent, null, 2)
    };
    
    // S'assurer qu'il y a un point d'entrée
    if (!sandpackFiles['/index.tsx'] && !sandpackFiles['/App.tsx']) {
      console.error('❌ Aucun point d\'entrée trouvé (index.tsx ou App.tsx)');
    }
    
    console.log('✅ Sandpack files:', Object.keys(sandpackFiles));
    return sandpackFiles;
  };

  const sandpackFiles = useMemo(() => 
    convertToSandpackFormat(projectFiles), 
    [projectFiles]
  );

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
        projectFiles={isHtmlProject ? projectFiles : sandpackFiles} 
        isDark={isDark}
        inspectMode={inspectMode}
        onElementSelect={handleElementSelect}
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
