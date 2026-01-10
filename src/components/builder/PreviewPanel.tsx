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
  // Afficher GeneratingPreview pendant la génération
  if (isGenerating) {
    return <GeneratingPreview />;
  }

  // Si aucun fichier n'est encore disponible, afficher un état de chargement.
  // (Sinon, on laisse Sandpack tenter le rendu + gérer les erreurs)
  if (Object.keys(projectFiles).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 mx-auto mb-4 text-primary" />
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
