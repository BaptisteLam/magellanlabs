import { UnifiedPreview } from './UnifiedPreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Composant de preview utilisant Sandpack - solution unifiée et fiable
 */
export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {

  return (
    <UnifiedPreview
      projectFiles={projectFiles}
      isDark={isDark}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
