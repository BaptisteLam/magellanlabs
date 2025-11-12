import { useMemo } from 'react';
import { WebContainerPreview } from './WebContainerPreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

/**
 * Composant de preview utilisant WebContainer pour un vrai environnement Vite
 */
export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {

  // Normaliser les fichiers au format approprié
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      normalized[path] = typeof content === 'string' ? content : content.code;
    }
    return normalized;
  }, [projectFiles]);

  console.log('🎯 Using WebContainer for preview');

  return (
    <WebContainerPreview
      projectFiles={normalizedFiles}
      isDark={isDark}
    />
  );
}
