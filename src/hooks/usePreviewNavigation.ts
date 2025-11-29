import { useState, useCallback, useEffect } from 'react';

export interface NavigationState {
  currentFile: string;
  history: string[];
  historyIndex: number;
  is404: boolean;
}

export function usePreviewNavigation(initialFile: string = 'index.html') {
  const [state, setState] = useState<NavigationState>({
    currentFile: initialFile,
    history: [initialFile],
    historyIndex: 0,
    is404: false
  });

  const navigateTo = useCallback((file: string, addToHistory: boolean = true) => {
    setState(prev => {
      if (addToHistory) {
        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        return {
          currentFile: file,
          history: [...newHistory, file],
          historyIndex: newHistory.length,
          is404: file === '__404__'
        };
      }
      return {
        ...prev,
        currentFile: file,
        is404: file === '__404__'
      };
    });
  }, []);

  const navigateBack = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        return {
          ...prev,
          currentFile: prev.history[newIndex],
          historyIndex: newIndex,
          is404: prev.history[newIndex] === '__404__'
        };
      }
      return prev;
    });
  }, []);

  const navigateForward = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex < prev.history.length - 1) {
        const newIndex = prev.historyIndex + 1;
        return {
          ...prev,
          currentFile: prev.history[newIndex],
          historyIndex: newIndex,
          is404: prev.history[newIndex] === '__404__'
        };
      }
      return prev;
    });
  }, []);

  const show404 = useCallback(() => {
    navigateTo('__404__', true);
  }, [navigateTo]);

  const canGoBack = state.historyIndex > 0;
  const canGoForward = state.historyIndex < state.history.length - 1;

  return {
    ...state,
    navigateTo,
    navigateBack,
    navigateForward,
    show404,
    canGoBack,
    canGoForward
  };
}