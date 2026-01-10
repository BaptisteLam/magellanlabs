/**
 * Hook de gestion de la synchronisation avec Supabase
 * Sync différentiel, debounce, background sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IndexedDBCache } from '@/services/indexedDBCache';
import { useToast } from '@/hooks/use-toast';
import { parseProjectFiles } from '@/lib/projectFilesParser';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface UseSyncManagerOptions {
  sessionId: string;
  debounceMs?: number;
  autoSync?: boolean;
}

export function useSyncManager({
  sessionId,
  debounceMs = 2000,
  autoSync = true
}: UseSyncManagerOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const { toast } = useToast();

  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const syncInProgressRef = useRef(false);
  const queuedSyncRef = useRef(false);

  /**
   * Synchronise les changements avec Supabase
   */
  const syncToSupabase = useCallback(async (
    projectFiles: Record<string, string>,
    force: boolean = false
  ) => {
    // Éviter les syncs multiples simultanés
    if (syncInProgressRef.current && !force) {
      queuedSyncRef.current = true;
      return;
    }

    syncInProgressRef.current = true;
    setSyncStatus('syncing');

    try {
      // Récupérer le projet actuel depuis Supabase
      const { data: currentSession, error: fetchError } = await supabase
        .from('build_sessions')
        .select('project_files')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      const oldFiles = parseProjectFiles(currentSession?.project_files);

      // Calculer le diff
      const diff = IndexedDBCache.calculateDiff(oldFiles, projectFiles);

      if (diff.length === 0) {
        console.log('📋 No changes to sync');
        setSyncStatus('synced');
        setLastSyncTime(Date.now());
        await IndexedDBCache.markAsSynced(sessionId);
        return;
      }

      console.log(`📤 Syncing ${diff.length} changes to Supabase`);

      // Sauvegarder seulement les fichiers modifiés
      const { error: updateError } = await supabase
        .from('build_sessions')
        .update({
          project_files: projectFiles,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Marquer comme syncé dans IndexedDB
      await IndexedDBCache.markAsSynced(sessionId);
      await IndexedDBCache.saveProject(sessionId, projectFiles, 'synced');

      setSyncStatus('synced');
      setLastSyncTime(Date.now());
      setPendingChanges(0);

      console.log('✅ Sync completed');

    } catch (error) {
      console.error('❌ Sync error:', error);
      setSyncStatus('error');
      
      
      toast({
        title: 'Sync error',
        description: 'Changes saved locally. Will retry when online.',
        variant: 'destructive'
      });
    } finally {
      syncInProgressRef.current = false;

      // Si un sync était en attente, le lancer maintenant
      if (queuedSyncRef.current) {
        queuedSyncRef.current = false;
        setTimeout(() => syncToSupabase(projectFiles, false), 500);
      }
    }
  }, [sessionId, toast]);

  /**
   * Déclenche un sync avec debounce
   */
  const triggerSync = useCallback((projectFiles: Record<string, string>) => {
    // Clear timeout précédent
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Sauvegarder immédiatement en local
    IndexedDBCache.saveProject(sessionId, projectFiles, 'synced');
    if (syncStatus !== 'syncing') {
      setSyncStatus('idle');
    }
    setPendingChanges(prev => prev + 1);

    // Debounce le sync Supabase
    syncTimeoutRef.current = setTimeout(() => {
      if (autoSync) {
        syncToSupabase(projectFiles);
      }
    }, debounceMs);
  }, [sessionId, debounceMs, autoSync, syncToSupabase]);

  /**
   * Force un sync immédiat (sans debounce)
   */
  const forceSyncNow = useCallback(async (projectFiles: Record<string, string>) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    await syncToSupabase(projectFiles, true);
  }, [syncToSupabase]);

  /**
   * Récupère depuis le cache local
   */
  const loadFromCache = useCallback(async () => {
    try {
      const cached = await IndexedDBCache.getProject(sessionId);
      if (cached) {
        console.log('📦 Loaded from cache:', cached.projectFiles);
        // Map 'pending' status to 'idle' for compatibility
        const mappedStatus: SyncStatus = cached.syncStatus === 'pending' ? 'idle' : cached.syncStatus as SyncStatus;
        setSyncStatus(mappedStatus);
        setLastSyncTime(cached.lastModified);
        return cached.projectFiles;
      }
      return null;
    } catch (error) {
      console.error('Error loading from cache:', error);
      return null;
    }
  }, [sessionId]);

  /**
   * Récupère les changements en attente
   */
  const loadPendingChanges = useCallback(async () => {
    try {
      const changes = await IndexedDBCache.getPendingChanges(sessionId);
      setPendingChanges(changes.length);
      return changes;
    } catch (error) {
      console.error('Error loading pending changes:', error);
      return [];
    }
  }, [sessionId]);

  /**
   * Détecte l'état online/offline
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Back online, syncing...');
      setSyncStatus('idle');
    };

    const handleOffline = () => {
      console.log('📴 Offline mode');
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // État initial
    if (!navigator.onLine) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    syncStatus,
    lastSyncTime,
    pendingChanges,
    triggerSync,
    forceSyncNow,
    loadFromCache,
    loadPendingChanges,
    isOnline: navigator.onLine
  };
}
