import { CodeTreeView } from '@/components/CodeEditor/CodeTreeView';
import { FileTabs } from '@/components/CodeEditor/FileTabs';
import { MonacoEditor } from '@/components/CodeEditor/MonacoEditor';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface CodePanelProps {
  projectFiles: Record<string, string>;
  selectedFile: string | null;
  selectedFileContent: string;
  openFiles: string[];
  onFileSelect: (path: string) => void;
  onFileChange: (content: string | undefined) => void;
  onCloseFile: (path: string) => void;
}

export function CodePanel({
  projectFiles,
  selectedFile,
  selectedFileContent,
  openFiles,
  onFileSelect,
  onFileChange,
  onCloseFile
}: CodePanelProps) {
  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'txt';
  };

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        <div className="h-full overflow-auto bg-muted/30 border-r border-border">
          <CodeTreeView
            files={projectFiles}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize={80}>
        <div className="h-full flex flex-col bg-background">
          {openFiles.length > 0 && (
            <FileTabs
              openFiles={openFiles}
              activeFile={selectedFile}
              onTabClick={onFileSelect}
              onTabClose={onCloseFile}
            />
          )}
          
          <div className="flex-1 overflow-hidden">
            {selectedFile ? (
              <MonacoEditor
                value={selectedFileContent}
                language={getFileExtension(selectedFile)}
                onChange={onFileChange}
                readOnly={false}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sélectionnez un fichier pour l'éditer
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
