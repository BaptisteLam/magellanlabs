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
  previewUrl: string;
  isSyncing?: boolean;
  syncError?: string | null;
  onRetrySync?: () => void;
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
  isSyncing = false,
  syncError = null,
  onRetrySync,
}: PreviewPanelProps) {
  // Afficher GeneratingPreview pendant la génération
  if (isGenerating) {
    return <GeneratingPreview />;
  }

  // Preview via iframe Cloudflare
  return (
    <InteractivePreview
      projectFiles={projectFiles}
      isDark={isDark}
      onElementModify={onElementModify}
      inspectMode={inspectMode}
      onInspectModeChange={onInspectModeChange}
      previewUrl={previewUrl}
      isSyncing={isSyncing}
      syncError={syncError}
      onRetrySync={onRetrySync}
    />
  );
}
