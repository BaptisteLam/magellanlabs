import { InteractivePreview } from '@/components/InteractivePreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
import type { ElementInfo } from '@/components/InteractivePreview';

interface PreviewPanelProps {
  projectFiles: Record<string, string>;
  isGenerating: boolean;
  isDark: boolean;
  inspectMode?: boolean;
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
}

export function PreviewPanel({
  projectFiles,
  isGenerating,
  isDark,
  inspectMode = false,
  onInspectModeChange = () => {},
  onElementModify
}: PreviewPanelProps) {
  // Afficher GeneratingPreview pendant toute la génération
  if (isGenerating) {
    return <GeneratingPreview />;
  }

  // Tous les projets sont des sites web statiques
  return (
    <InteractivePreview
      projectFiles={projectFiles}
      isDark={isDark}
      onElementModify={onElementModify}
      inspectMode={inspectMode}
      onInspectModeChange={onInspectModeChange}
    />
  );
}
