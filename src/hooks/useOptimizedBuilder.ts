/**
 * Combined hook for builder sessions with all optimizations
 * Integrates: IndexedDB cache, sync manager, hot reload, lazy loading
 */

import { useState, useEffect, useCallback } from 'react';
import { useSyncManager } from './useSyncManager';
import { usePreloadSessions } from './usePreloadSessions';
import { useHotReload } from './useHotReload';
import { LazyFileLoader } from '@/services/lazyFileLoader';
import { IndexedDBCache } from '@/services/indexedDBCache';

interface UseOptimizedBuilderOptions {
  sessionId: string;
  initialFiles?: Record<string, string>;
  autoSave?: boolean;
  debounceMs?: number;
  autoLoad?: boolean; // Disable automatic loading if false
}

export function useOptimizedBuilder({
  sessionId,
  initialFiles = {},
  autoSave = true,
  debounceMs = 2000,
  autoLoad = true // By default, load automatically
}: UseOptimizedBuilderOptions) {
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>(initialFiles);
  const [visibleFiles, setVisibleFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // ✅ FIX: Flag to indicate that files have been loaded at least once
  const [hasLoadedFiles, setHasLoadedFiles] = useState(false);

  // Sync manager for optimized saving
  const {
    syncStatus,
    lastSyncTime,
    pendingChanges,
    triggerSync,
    forceSyncNow,
    loadFromCache,
    isOnline
  } = useSyncManager({
    sessionId,
    debounceMs,
    autoSync: autoSave
  });

  // Smart preloading
  const {
    preloadedSessions,
    getPreloadedSession,
    preloadSession
  } = usePreloadSessions();

  // Hot reload for instant updates
  const hotReload = useHotReload(projectFiles);

  /**
   * Load the session on mount (only if autoLoad = true)
   */
  useEffect(() => {
    if (!autoLoad) {
      setIsLoading(false);
      return;
    }

    const loadSession = async () => {
      setIsLoading(true);

      try {
        // 1. Try the preloaded cache first
        const preloaded = getPreloadedSession(sessionId);
        if (preloaded) {
          console.log('⚡ Using preloaded session');
          setProjectFiles(preloaded.projectFiles);
          setIsLoading(false);
          return;
        }

        // 2. Try the IndexedDB cache
        const cached = await loadFromCache();
        if (cached) {
          console.log('📦 Loaded from IndexedDB cache');
          setProjectFiles(cached);
          setIsLoading(false);
          return;
        }

        // 3. Preload from Supabase
        const files = await preloadSession(sessionId);
        if (files) {
          console.log('🌐 Loaded from Supabase');
          setProjectFiles(files);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId, autoLoad, getPreloadedSession, loadFromCache, preloadSession]);

  /**
   * Update files with lazy loading
   */
  const updateFiles = useCallback((
    newFiles: Record<string, string>,
    triggerSave: boolean = true
  ) => {
    // ✅ FIX: Update IMMEDIATELY with ALL files
    // Without going through LazyFileLoader which may return incomplete files
    setProjectFiles(prev => {
      const merged = { ...prev, ...newFiles };
      console.log('📁 updateFiles: Updated projectFiles', {
        prevCount: Object.keys(prev).length,
        newCount: Object.keys(newFiles).length,
        mergedCount: Object.keys(merged).length
      });
      return merged;
    });

    // ✅ FIX: Mark that files have been loaded
    if (Object.keys(newFiles).length > 0) {
      setHasLoadedFiles(true);
    }

    // Lazy loading in the background (optional, does not block rendering)
    if (visibleFiles.length > 0) {
      LazyFileLoader.loadFiles(newFiles, visibleFiles).catch(console.error);
    }
    
    // Trigger sync if autoSave is enabled
    if (triggerSave && autoSave) {
      triggerSync(newFiles);
    }
  }, [visibleFiles, autoSave, triggerSync]);

  /**
   * Update a single file
   */
  const updateFile = useCallback((path: string, content: string) => {
    const newFiles = { ...projectFiles, [path]: content };
    updateFiles(newFiles, true);
  }, [projectFiles, updateFiles]);

  /**
   * Mark files as visible (for lazy loading)
   */
  const setFilesVisible = useCallback((paths: string[]) => {
    setVisibleFiles(paths);

    // Load visible files if not yet loaded
    paths.forEach(path => {
      if (projectFiles[path] && !LazyFileLoader.getStats().loadedCount) {
        LazyFileLoader.loadFileOnDemand(path, projectFiles);
      }
    });
  }, [projectFiles]);

  /**
   * Force an immediate save
   */
  const saveNow = useCallback(async () => {
    await forceSyncNow(projectFiles);
  }, [projectFiles, forceSyncNow]);

  /**
   * Clean up resources
   */
  useEffect(() => {
    return () => {
      // Cleanup lazy loader
      LazyFileLoader.clearLoadedFiles();
    };
  }, []);

  return {
    // State
    projectFiles,
    isLoading,
    isOnline,
    hasLoadedFiles, // ✅ FIX: Expose the flag
    
    // Sync status
    syncStatus,
    lastSyncTime,
    pendingChanges,
    
    // Hot reload
    isUpdating: hotReload.isUpdating,
    updateType: hotReload.lastUpdateType,
    
    // Actions
    updateFiles,
    updateFile,
    saveNow,
    setFilesVisible,
    
    // Preloaded sessions
    preloadedSessions
  };
}
