import { SandpackPreview } from './SandpackPreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  showEditor?: boolean;
  onFilesChange?: (files: Record<string, string>) => void;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Composant de preview utilisant Sandpack en marque blanche
 * Peut afficher l'éditeur de code intégré
 */
export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  showEditor = false,
  onFilesChange,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {

  return (
    <SandpackPreview
      projectFiles={projectFiles}
      isDark={isDark}
      showEditor={showEditor}
      onFilesChange={onFilesChange}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
