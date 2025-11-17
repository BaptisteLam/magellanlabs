import { useMemo, useState, useEffect } from 'react';
import { BabelPreview } from './BabelPreview';
import { CustomIframePreview } from './CustomIframePreview';
import { SandpackPreview } from './SandpackPreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
  projectType?: 'website' | 'webapp' | 'mobile';
}

export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect,
  projectType = 'webapp'
}: HybridPreviewProps) {
  // Normaliser les fichiers
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      normalized[path] = typeof content === 'string' ? content : content.code;
    }
    return normalized;
  }, [projectFiles]);

  // Détecter le type de projet - forcer 'static' si projectType === 'website'
  const projectTypeComputed = useMemo(() => {
    if (projectType === 'website') {
      return 'static';
    }
    
    const files = Object.keys(projectFiles);
    
    const hasReactFiles = files.some(path => 
      path.endsWith('.tsx') || 
      path.endsWith('.jsx') || 
      path.includes('App.tsx') || 
      path.includes('main.tsx') ||
      path.includes('package.json')
    );
    
    console.log('🔍 HybridPreview - Type détecté:', hasReactFiles ? 'React' : 'HTML');
    
    return hasReactFiles ? 'react' : 'static';
  }, [projectFiles, projectType]);

  // Écouter les messages de sélection d'élément
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  if (projectTypeComputed === 'react') {
    return (
      <BabelPreview 
        projectFiles={normalizedFiles} 
        isDark={isDark}
      />
    );
  }

  // Pour les sites web statiques, utiliser Sandpack
  if (projectType === 'website') {
    return (
      <SandpackPreview 
        projectFiles={normalizedFiles} 
        isDark={isDark}
      />
    );
  }

  // Fallback pour les autres types
  return (
    <CustomIframePreview 
      projectFiles={normalizedFiles} 
      isDark={isDark}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
