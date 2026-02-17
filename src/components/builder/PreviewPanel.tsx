import { InteractiveCodeSandboxPreview } from '@/components/InteractiveCodeSandboxPreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';
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
  // Afficher GeneratingPreview tant que la génération est en cours OU qu'aucun fichier/URL n'est disponible
  if (isGenerating || (Object.keys(projectFiles).length === 0 && !previewUrl)) {
    return <GeneratingPreview />;
  }

  // Si on a un previewUrl VibeSDK, l'afficher directement dans un iframe
  if (previewUrl) {
    return (
      <div className="w-full h-full">
        <iframe
          src={previewUrl}
          title="Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        />
      </div>
    );
  }

  // Fallback: Preview via CodeSandbox / LocalInspectablePreview
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
