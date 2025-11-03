import { create } from 'zustand';

export interface ProjectFile {
  path: string;
  content: string;
  type: string;
}

interface ProjectStore {
  projectFiles: ProjectFile[];
  setProjectFiles: (files: ProjectFile[]) => void;
  updateFile: (path: string, content: string) => void;
  addFile: (file: ProjectFile) => void;
  removeFile: (path: string) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projectFiles: [],
  
  setProjectFiles: (files) => set({ projectFiles: files }),
  
  updateFile: (path, content) =>
    set((state) => ({
      projectFiles: state.projectFiles.map((file) =>
        file.path === path ? { ...file, content } : file
      ),
    })),
  
  addFile: (file) =>
    set((state) => ({
      projectFiles: [...state.projectFiles, file],
    })),
  
  removeFile: (path) =>
    set((state) => ({
      projectFiles: state.projectFiles.filter((file) => file.path !== path),
    })),
  
  clearProject: () => set({ projectFiles: [] }),
}));
