import { InteractivePreview } from '@/components/InteractivePreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
import { SandpackHotReload } from '@/components/SandpackHotReload';
import { ExpoSnackPreview } from '@/components/ExpoSnackPreview';
import type { ElementInfo } from '@/components/InteractivePreview';

interface PreviewPanelProps {
  projectType: 'website' | 'webapp' | 'mobile';
  projectFiles: Record<string, string>;
  isGenerating: boolean;
  isDark: boolean;
  inspectMode?: boolean;
  previewMode?: 'desktop' | 'mobile';
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
}

export function PreviewPanel({
  projectType,
  projectFiles,
  isGenerating,
  isDark,
  inspectMode = false,
  previewMode = 'desktop',
  onInspectModeChange = () => {},
  onElementModify
}: PreviewPanelProps) {
  if (isGenerating && Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  // Site statique - utilise InteractivePreview avec HotReload
  if (projectType === 'website') {
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

  // Application mobile - utilise ExpoSnackPreview
  if (projectType === 'mobile') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <ExpoSnackPreview files={projectFiles} isDark={isDark} />
      </div>
    );
  }

  // Application web - utilise Sandpack avec HMR
  return (
    <div className="h-full w-full">
      <SandpackHotReload files={projectFiles} isDark={isDark} />
    </div>
  );
}
