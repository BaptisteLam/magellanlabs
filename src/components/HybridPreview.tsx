import { WebContainerPreview } from './WebContainerPreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Composant de preview utilisant WebContainers (StackBlitz Tech) en marque blanche
 */
export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {

  return (
    <WebContainerPreview
      projectFiles={projectFiles}
      isDark={isDark}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
