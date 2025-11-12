import { useMemo } from 'react';
import { SandpackPreview } from './SandpackPreview';
import { SandpackContext } from '@/contexts/SandpackContext';

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

  // Normaliser les fichiers au format { code: string }
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, { code: string }> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      const fileContent = typeof content === 'string' ? content : content.code;
      normalized[path] = { code: fileContent };
    }
    return normalized;
  }, [projectFiles]);

  // Détecter si c'est un projet React
  const isReactProject = useMemo(() => {
    return Object.keys(projectFiles).some(path => 
      path.includes('App.tsx') || 
      path.includes('App.jsx') || 
      path.includes('main.tsx') || 
      path.includes('main.jsx') ||
      path.includes('package.json')
    );
  }, [projectFiles]);

  return (
    <SandpackContext 
      files={normalizedFiles} 
      isDark={isDark}
      isReactProject={isReactProject}
    >
      <SandpackPreview
        projectFiles={projectFiles}
        isDark={isDark}
        showEditor={showEditor}
      />
    </SandpackContext>
  );
}
