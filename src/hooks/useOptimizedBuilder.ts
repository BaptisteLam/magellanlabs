/**
 * Hook combiné pour builder sessions avec toutes les optimisations
 * Intègre: cache IndexedDB, sync manager, hot reload, lazy loading
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
}

export function useOptimizedBuilder({
  sessionId,
  initialFiles = {},
  autoSave = true,
  debounceMs = 2000
}: UseOptimizedBuilderOptions) {
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>(initialFiles);
  const [visibleFiles, setVisibleFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync manager pour sauvegarde optimisée
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

  // Préchargement intelligent
  const {
    preloadedSessions,
    getPreloadedSession,
    preloadSession
  } = usePreloadSessions();

  // Hot reload pour updates instantanés
  const hotReload = useHotReload(projectFiles);

  /**
   * Charge la session au montage
   */
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);

      try {
        // 1. Essayer le cache préchargé d'abord
        const preloaded = getPreloadedSession(sessionId);
        if (preloaded) {
          console.log('⚡ Using preloaded session');
          setProjectFiles(preloaded.projectFiles);
          setIsLoading(false);
          return;
        }

        // 2. Essayer le cache IndexedDB
        const cached = await loadFromCache();
        if (cached) {
          console.log('📦 Loaded from IndexedDB cache');
          setProjectFiles(cached);
          setIsLoading(false);
          return;
        }

        // 3. Précharger depuis Supabase
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
  }, [sessionId, getPreloadedSession, loadFromCache, preloadSession]);

  /**
   * Met à jour les fichiers avec lazy loading
   */
  const updateFiles = useCallback(async (
    newFiles: Record<string, string>,
    triggerSave: boolean = true
  ) => {
    // Lazy loading des fichiers selon priorité
    const loadedFiles = await LazyFileLoader.loadFiles(newFiles, visibleFiles);
    
    setProjectFiles(loadedFiles);

    // Hot reload si changements CSS/HTML seulement
    // Le hook useHotReload détecte automatiquement les changements
    
    // Trigger sync si autoSave activé
    if (triggerSave && autoSave) {
      triggerSync(newFiles); // On sync tous les fichiers, pas juste les loadedFiles
    }
  }, [projectFiles, visibleFiles, autoSave, triggerSync]);

  /**
   * Met à jour un seul fichier
   */
  const updateFile = useCallback((path: string, content: string) => {
    const newFiles = { ...projectFiles, [path]: content };
    updateFiles(newFiles, true);
  }, [projectFiles, updateFiles]);

  /**
   * Marque des fichiers comme visibles (pour lazy loading)
   */
  const setFilesVisible = useCallback((paths: string[]) => {
    setVisibleFiles(paths);

    // Charger les fichiers visibles si pas encore chargés
    paths.forEach(path => {
      if (projectFiles[path] && !LazyFileLoader.getStats().loadedCount) {
        LazyFileLoader.loadFileOnDemand(path, projectFiles);
      }
    });
  }, [projectFiles]);

  /**
   * Force une sauvegarde immédiate
   */
  const saveNow = useCallback(async () => {
    await forceSyncNow(projectFiles);
  }, [projectFiles, forceSyncNow]);

  /**
   * Nettoie les ressources
   */
  useEffect(() => {
    return () => {
      // Cleanup lazy loader
      LazyFileLoader.clearLoadedFiles();
    };
  }, []);

  return {
    // État
    projectFiles,
    isLoading,
    isOnline,
    
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
    
    // Sessions préchargées
    preloadedSessions
  };
}
