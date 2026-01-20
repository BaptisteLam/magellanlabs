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
  // Afficher GeneratingPreview UNIQUEMENT si aucun fichier n'est disponible
  // Prioriser l'affichage des fichiers même si isGenerating est encore true
  if (Object.keys(projectFiles).length === 0) {
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
