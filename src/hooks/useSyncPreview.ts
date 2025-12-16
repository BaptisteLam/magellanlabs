import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSyncPreviewOptions {
  sessionId: string;
  projectFiles: Record<string, string>;
  debounceMs?: number;
  enabled?: boolean;
}

interface SyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSync: Date | null;
  previewUrl: string | null;
  error: string | null;
}

export function useSyncPreview({
  sessionId,
  projectFiles,
  debounceMs = 2000,
  enabled = true,
}: UseSyncPreviewOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle',
    lastSync: null,
    previewUrl: null,
    error: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedFilesRef = useRef<string>('');
  const isSyncingRef = useRef(false);

  // Fonction pour synchroniser vers Cloudflare KV
  const syncToCloudflare = useCallback(async () => {
    if (!sessionId || !enabled || Object.keys(projectFiles).length === 0) {
      return;
    }

    // Éviter les syncs multiples simultanés
    if (isSyncingRef.current) {
      console.log('⏸️ Sync déjà en cours, ignoré');
      return;
    }

    // Vérifier si les fichiers ont changé
    const filesHash = JSON.stringify(projectFiles);
    if (filesHash === lastSyncedFilesRef.current) {
      console.log('📦 Fichiers inchangés, sync ignoré');
      return;
    }

    isSyncingRef.current = true;
    setSyncStatus(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      console.log('🔄 Synchronisation vers Cloudflare KV...');
      console.log('📁 Fichiers:', Object.keys(projectFiles));

      const { data, error } = await supabase.functions.invoke('sync-preview', {
        body: { sessionId, projectFiles },
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ Sync réussi:', data);
      lastSyncedFilesRef.current = filesHash;

      setSyncStatus({
        status: 'synced',
        lastSync: new Date(),
        previewUrl: data.previewUrl || `https://${sessionId}.builtbymagellan.com`,
        error: null,
      });

    } catch (err: any) {
      console.error('❌ Erreur sync:', err);
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'Erreur de synchronisation',
      }));
    } finally {
      isSyncingRef.current = false;
    }
  }, [sessionId, projectFiles, enabled]);

  // Déclencher le sync avec debounce quand les fichiers changent
  useEffect(() => {
    if (!enabled || Object.keys(projectFiles).length === 0) {
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      syncToCloudflare();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectFiles, enabled, debounceMs, syncToCloudflare]);

  // Sync initial au montage
  useEffect(() => {
    if (enabled && Object.keys(projectFiles).length > 0) {
      // Sync immédiat au premier chargement
      syncToCloudflare();
    }
  }, [enabled]); // Seulement au changement de enabled, pas à chaque changement de projectFiles

  // Forcer un sync immédiat
  const forceSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    lastSyncedFilesRef.current = ''; // Reset pour forcer la mise à jour
    syncToCloudflare();
  }, [syncToCloudflare]);

  return {
    syncStatus,
    forceSync,
    previewUrl: syncStatus.previewUrl || `https://${sessionId}.builtbymagellan.com`,
    isSyncing: syncStatus.status === 'syncing',
  };
}
