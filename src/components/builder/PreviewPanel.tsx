import { InteractiveCodeSandboxPreview } from '@/components/InteractiveCodeSandboxPreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
import { VibePreviewIframe } from '@/components/builder/VibePreviewIframe';
import type { ElementInfo } from '@/types/elementInfo';

interface PreviewPanelProps {
  projectFiles: Record<string, string>;
  isGenerating: boolean;
  isDark: boolean;
  inspectMode?: boolean;
  previewMode?: 'desktop' | 'mobile';
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
  previewUrl?: string;
}

export function PreviewPanel({
  projectFiles,
  isGenerating,
  isDark,
  inspectMode = false,
  previewMode = 'desktop',
  onInspectModeChange = () => {},
  onElementModify,
  previewUrl,
}: PreviewPanelProps) {
  if (isGenerating || (Object.keys(projectFiles).length === 0 && !previewUrl)) {
    return <GeneratingPreview />;
  }

  if (previewUrl) {
    return <VibePreviewIframe src={previewUrl} />;
  }

  return (
    <InteractiveCodeSandboxPreview
      projectFiles={projectFiles}
      previewMode={previewMode}
      inspectMode={inspectMode}
      onInspectModeChange={onInspectModeChange}
      onElementModify={onElementModify}
    />
  );
}
