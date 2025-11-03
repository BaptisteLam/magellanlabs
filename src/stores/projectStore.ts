import { create } from 'zustand';

interface ProjectFile {
  path: string;
  content: string;
  type: string;
}

interface ProjectState {
  projectFiles: ProjectFile[];
  generatedHtml: string;
  setProjectFiles: (files: ProjectFile[]) => void;
  setGeneratedHtml: (html: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectFiles: [],
  generatedHtml: '',
  setProjectFiles: (files) => set({ projectFiles: files }),
  setGeneratedHtml: (html) => set({ generatedHtml: html }),
}));
