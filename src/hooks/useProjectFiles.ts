import { useState, useEffect } from 'react';

export function useProjectFiles(initialFiles: Record<string, string> = {}) {
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  useEffect(() => {
    if (Object.keys(initialFiles).length > 0) {
      setProjectFiles(initialFiles);
      const firstFile = Object.keys(initialFiles)[0];
      if (firstFile && !selectedFile) {
        setSelectedFile(firstFile);
        setSelectedFileContent(initialFiles[firstFile]);
      }
    }
  }, [initialFiles]);

  useEffect(() => {
    if (selectedFile && projectFiles[selectedFile]) {
      setSelectedFileContent(projectFiles[selectedFile]);
    }
  }, [selectedFile, projectFiles]);

  const updateFile = (path: string, content: string) => {
    setProjectFiles(prev => ({
      ...prev,
      [path]: content
    }));
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    setSelectedFileContent(projectFiles[path] || '');
    
    if (!openFiles.includes(path)) {
      setOpenFiles(prev => [...prev, path]);
    }
  };

  const handleFileChange = (newContent: string | undefined) => {
    if (newContent !== undefined && selectedFile) {
      updateFile(selectedFile, newContent);
    }
  };

  const handleCloseFile = (path: string) => {
    setOpenFiles(prev => prev.filter(f => f !== path));
    if (selectedFile === path) {
      const remaining = openFiles.filter(f => f !== path);
      if (remaining.length > 0) {
        setSelectedFile(remaining[0]);
      } else {
        setSelectedFile(null);
      }
    }
  };

  return {
    projectFiles,
    setProjectFiles,
    selectedFile,
    selectedFileContent,
    openFiles,
    handleFileSelect,
    handleFileChange,
    handleCloseFile,
    updateFile
  };
}
