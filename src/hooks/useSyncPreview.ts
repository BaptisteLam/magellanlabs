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
  versionId: string | null;
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
    versionId: null,
    error: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedFilesRef = useRef<string>('');
  const isSyncingRef = useRef(false);

  // Sync to Cloudflare KV via sync-to-kv
  const syncToKV = useCallback(async () => {
    if (!sessionId || !enabled || Object.keys(projectFiles).length === 0) {
      return;
    }

    // Avoid concurrent syncs
    if (isSyncingRef.current) {
      console.log('⏸️ Sync already in progress, skipped');
      return;
    }

    // Check if files changed
    const filesHash = JSON.stringify(projectFiles);
    if (filesHash === lastSyncedFilesRef.current) {
      console.log('📦 Files unchanged, sync skipped');
      return;
    }

    isSyncingRef.current = true;
    setSyncStatus(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      console.log('🔄 Syncing to KV for session:', sessionId);
      console.log('📁 Files:', Object.keys(projectFiles));

      const { data, error } = await supabase.functions.invoke('sync-to-kv', {
        body: {
          sessionId,
          projectFiles,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Vérifier si la réponse contient une erreur
      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('✅ KV synced:', data);
      lastSyncedFilesRef.current = filesHash;

      setSyncStatus({
        status: 'synced',
        lastSync: new Date(),
        previewUrl: data.previewUrl || `https://${sessionId}.builtbymagellan.com`,
        versionId: data.versionId || null,
        error: null,
      });

    } catch (err: any) {
      console.error('❌ Sync error:', err);
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'Erreur de synchronisation',
      }));
    } finally {
      isSyncingRef.current = false;
    }
  }, [sessionId, projectFiles, enabled]);

  // Debounced sync when files change
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
      syncToKV();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectFiles, enabled, debounceMs, syncToKV]);

  // Initial sync on mount
  useEffect(() => {
    if (enabled && Object.keys(projectFiles).length > 0) {
      syncToKV();
    }
  }, [enabled]); // Only on enabled change, not every projectFiles change

  // Force immediate sync
  const forceSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    lastSyncedFilesRef.current = ''; // Reset to force update
    syncToKV();
  }, [syncToKV]);

  return {
    syncStatus,
    forceSync,
    previewUrl: syncStatus.previewUrl || `https://${sessionId}.builtbymagellan.com`,
    versionId: syncStatus.versionId,
    isSyncing: syncStatus.status === 'syncing',
    syncError: syncStatus.error,
  };
}
