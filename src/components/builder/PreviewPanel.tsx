import { useMemo } from 'react';
import { InteractiveSandpackPreview } from '@/components/InteractiveSandpackPreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
import { Loader } from 'lucide-react';
import type { ElementInfo } from '@/components/InteractiveSandpackPreview';

interface PreviewPanelProps {
  projectFiles: Record<string, string>;
  isGenerating: boolean;
  isDark: boolean;
  inspectMode?: boolean;
  previewMode?: 'desktop' | 'mobile';
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
}

export function PreviewPanel({
  projectFiles,
  isGenerating,
  isDark,
  inspectMode = false,
  previewMode = 'desktop',
  onInspectModeChange = () => {},
  onElementModify,
}: PreviewPanelProps) {
  // ✅ FIX: Vérifier si on a des fichiers React valides
  const hasValidFiles = useMemo(() => {
    const keys = Object.keys(projectFiles);
    if (keys.length === 0) return false;
    return keys.some(k => 
      k.includes('App.tsx') || 
      k.includes('App.jsx') || 
      k.includes('main.tsx') ||
      k.includes('index.tsx')
    );
  }, [projectFiles]);

  // Afficher GeneratingPreview pendant la génération
  if (isGenerating) {
    return <GeneratingPreview />;
  }

  // ✅ FIX: Afficher un loader si les fichiers ne sont pas encore prêts
  if (!hasValidFiles) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 mx-auto mb-4 text-[#03A5C0]" />
          <p className="text-muted-foreground">Chargement du projet...</p>
        </div>
      </div>
    );
  }

  // Preview via Sandpack
  return (
    <InteractiveSandpackPreview
      projectFiles={projectFiles}
      previewMode={previewMode}
      inspectMode={inspectMode}
      onInspectModeChange={onInspectModeChange}
      onElementModify={onElementModify}
    />
  );
}
