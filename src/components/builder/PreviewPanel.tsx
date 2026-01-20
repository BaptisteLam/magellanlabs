import { InteractiveSandpackPreview } from '@/components/InteractiveSandpackPreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
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
  // Afficher GeneratingPreview pendant la génération OU si aucun fichier n'est disponible
  if (isGenerating || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
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
