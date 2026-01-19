import { E2BPreview } from '@/components/E2BPreview';
import { GeneratingPreview } from '@/components/GeneratingPreview';

interface PreviewPanelProps {
  projectFiles: Record<string, string>;
  isGenerating: boolean;
  isDark: boolean;
  inspectMode?: boolean;
  previewMode?: 'desktop' | 'mobile';
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: any) => void;
}

export function PreviewPanel({
  projectFiles,
  isGenerating,
  previewMode = 'desktop',
}: PreviewPanelProps) {
  // Afficher GeneratingPreview pendant la génération OU si aucun fichier n'est disponible
  if (isGenerating || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  // Preview via E2B
  return (
    <E2BPreview
      projectFiles={projectFiles}
      previewMode={previewMode}
    />
  );
}
