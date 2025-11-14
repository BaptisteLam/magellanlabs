import { SandpackPreview } from './SandpackPreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Composant de preview utilisant Sandpack en marque blanche
 */
export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {

  return (
    <SandpackPreview
      projectFiles={projectFiles}
      isDark={isDark}
      showEditor={false}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
