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
  // Afficher GeneratingPreview tant que la génération est en cours OU qu'aucun fichier n'est disponible
  // La preview du site ne s'affiche qu'une fois la génération terminée ET les fichiers reçus
  if (isGenerating || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  // Preview via CodeSandbox
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
