import { useMemo } from 'react';
import { FastPreview } from './FastPreview';

interface UnifiedPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  showEditor?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Preview unifiée utilisant Sandpack pour tous les types de projets
 */
export function UnifiedPreview({ 
  projectFiles, 
  isDark = false,
  showEditor = false,
  inspectMode = false,
  onElementSelect 
}: UnifiedPreviewProps) {

  // Normaliser les fichiers au format string
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      normalized[path] = typeof content === 'string' ? content : content.code;
    }
    return normalized;
  }, [projectFiles]);

  return (
    <FastPreview
      projectFiles={normalizedFiles}
      isDark={isDark}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
