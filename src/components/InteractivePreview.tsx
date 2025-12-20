import { useState } from 'react';
import { CloudflarePreview } from './CloudflarePreview';
import { FloatingEditBar } from './FloatingEditBar';
import { type ElementInfo } from './InspectOverlay';

interface InteractivePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onElementModify?: (prompt: string, elementInfo: ElementInfo) => void;
  inspectMode: boolean;
  onInspectModeChange: (mode: boolean) => void;
  previewUrl: string;
  isSyncing?: boolean;
  syncError?: string | null;
  onRetrySync?: () => void;
}

export type { ElementInfo };

export function InteractivePreview({ 
  projectFiles, 
  isDark = false, 
  onElementModify, 
  inspectMode, 
  onInspectModeChange,
  previewUrl,
  isSyncing = false,
  syncError = null,
  onRetrySync,
}: InteractivePreviewProps) {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Gérer la sélection d'élément
  const handleElementSelect = (elementInfo: ElementInfo) => {
    setSelectedElement(elementInfo);
    setShowEditDialog(true);
    onInspectModeChange(false);
  };

  const handleModify = (prompt: string) => {
    if (selectedElement && onElementModify) {
      onElementModify(prompt, selectedElement);
    }
    setShowEditDialog(false);
    setSelectedElement(null);
  };

  return (
    <div className="relative w-full h-full">
      {/* Overlay d'aide en mode inspection */}
      {inspectMode && (
        <div className="absolute top-16 right-4 z-10 bg-background border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="text-sm text-muted-foreground">
            Cliquez sur un élément pour le modifier
          </p>
        </div>
      )}

      {/* Preview via iframe Cloudflare */}
      <CloudflarePreview 
        previewUrl={previewUrl}
        isDark={isDark}
        inspectMode={inspectMode}
        onElementSelect={handleElementSelect}
        isSyncing={isSyncing}
        syncError={syncError}
        onRetrySync={onRetrySync}
      />

      {/* Barre de prompt volante */}
      <FloatingEditBar
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedElement(null);
        }}
        elementInfo={selectedElement}
        onModify={handleModify}
      />
    </div>
  );
}
