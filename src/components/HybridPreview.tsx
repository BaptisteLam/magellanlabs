import { useMemo, useState, useEffect } from 'react';
import { ESBuildPreview } from './ESBuildPreview';
import { CustomIframePreview } from './CustomIframePreview';

interface HybridPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function HybridPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: HybridPreviewProps) {
  // Normaliser les fichiers
  const normalizedFiles = useMemo(() => {
    const normalized: Record<string, string> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      normalized[path] = typeof content === 'string' ? content : content.code;
    }
    return normalized;
  }, [projectFiles]);

  // Détecter le type de projet
  const projectType = useMemo(() => {
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
  }, [projectFiles]);

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

  if (projectType === 'react') {
    return (
      <ESBuildPreview 
        projectFiles={projectFiles} 
        isDark={isDark}
      />
    );
  }

  return (
    <CustomIframePreview 
      projectFiles={normalizedFiles} 
      isDark={isDark}
      inspectMode={inspectMode}
      onElementSelect={onElementSelect}
    />
  );
}
