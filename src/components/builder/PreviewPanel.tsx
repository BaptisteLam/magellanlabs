import { InteractivePreview } from '@/components/InteractivePreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
import type { ElementInfo } from '@/components/InteractivePreview';

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
  onElementModify
}: PreviewPanelProps) {
  // Afficher GeneratingPreview pendant la génération
  if (isGenerating) {
    return <GeneratingPreview />;
  }

  // Preview unifiée via Sandpack (plus de distinction website/webapp)
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
