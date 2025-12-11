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
  autoLoad?: boolean; // Désactiver le chargement automatique si false
}

export function useOptimizedBuilder({
  sessionId,
  initialFiles = {},
  autoSave = true,
  debounceMs = 2000,
  autoLoad = true // Par défaut, charger automatiquement
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
   * Charge la session au montage (seulement si autoLoad = true)
   */
  useEffect(() => {
    if (!autoLoad) {
      console.log('🔒 useOptimizedBuilder: autoLoad disabled for session:', sessionId);
      setIsLoading(false);
      return;
    }

    console.log('🔄 useOptimizedBuilder: Starting auto-load for session:', sessionId);
    const loadSession = async () => {
      setIsLoading(true);

      try {
        // 1. Essayer le cache préchargé d'abord
        console.log('📦 Checking preloaded cache...');
        const preloaded = getPreloadedSession(sessionId);
        if (preloaded) {
          console.log('⚡ Using preloaded session - Files:', Object.keys(preloaded.projectFiles).length);
          setProjectFiles(preloaded.projectFiles);
          setIsLoading(false);
          return;
        }

        // 2. Essayer le cache IndexedDB
        console.log('💾 Checking IndexedDB cache...');
        const cached = await loadFromCache();
        if (cached) {
          console.log('📦 Loaded from IndexedDB cache - Files:', Object.keys(cached).length);
          setProjectFiles(cached);
          setIsLoading(false);
          return;
        }

        // 3. Précharger depuis Supabase
        console.log('🌐 Loading from Supabase...');
        const files = await preloadSession(sessionId);
        if (files) {
          console.log('🌐 Loaded from Supabase - Files:', Object.keys(files).length);
          setProjectFiles(files);
        } else {
          console.log('⚠️ No files loaded from Supabase');
        }
      } catch (error) {
        console.error('❌ Error loading session:', error);
      } finally {
        setIsLoading(false);
        console.log('✅ useOptimizedBuilder: Load complete for session:', sessionId);
      }
    };

    loadSession();
  }, [sessionId, autoLoad, getPreloadedSession, loadFromCache, preloadSession]);

  /**
   * Met à jour les fichiers avec lazy loading
   */
  const updateFiles = useCallback(async (
    newFiles: Record<string, string>,
    triggerSave: boolean = true
  ) => {
    console.log('📝 useOptimizedBuilder: Updating files -', {
      newFileCount: Object.keys(newFiles).length,
      triggerSave,
      autoSave,
      sessionId
    });

    // Lazy loading des fichiers selon priorité
    const loadedFiles = await LazyFileLoader.loadFiles(newFiles, visibleFiles);

    setProjectFiles(loadedFiles);

    // Hot reload si changements CSS/HTML seulement
    // Le hook useHotReload détecte automatiquement les changements

    // Trigger sync si autoSave activé
    if (triggerSave && autoSave) {
      console.log('💾 useOptimizedBuilder: Triggering sync for session:', sessionId);
      triggerSync(newFiles); // On sync tous les fichiers, pas juste les loadedFiles
    } else {
      console.log('⏸️ useOptimizedBuilder: Sync skipped (triggerSave:', triggerSave, 'autoSave:', autoSave + ')');
    }
  }, [projectFiles, visibleFiles, autoSave, triggerSync, sessionId]);

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
    console.log('💾 useOptimizedBuilder: Forcing immediate save for session:', sessionId);
    await forceSyncNow(projectFiles);
    console.log('✅ useOptimizedBuilder: Save completed for session:', sessionId);
  }, [projectFiles, forceSyncNow, sessionId]);

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
