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
  deploymentId: string | null;
  deploymentStatus: string;
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
    deploymentId: null,
    deploymentStatus: 'READY',
    error: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedFilesRef = useRef<string>('');
  const isSyncingRef = useRef(false);

  // Sync to Vercel via sync-to-vercel
  const syncToVercel = useCallback(async () => {
    if (!sessionId || !enabled || Object.keys(projectFiles).length === 0) {
      console.log('⏭️ Sync skipped: missing sessionId, disabled, or no files');
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

    const fileCount = Object.keys(projectFiles).length;
    console.log(`🔄 Starting sync to Vercel for session: ${sessionId.substring(0, 8)}...`);
    console.log(`📁 Files to sync: ${fileCount}`);

    isSyncingRef.current = true;
    setSyncStatus(prev => ({ ...prev, status: 'syncing', error: null, deploymentStatus: 'BUILDING' }));

    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('sync-to-vercel', {
        body: {
          sessionId,
          projectFiles,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Check if response contains an error
      if (data?.error) {
        throw new Error(data.error);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Vercel sync complete in ${duration}ms`);
      console.log(`📊 Result: ${data.filesUploaded || 0} new, ${data.filesUnchanged || 0} unchanged`);
      console.log(`🌐 Preview URL: ${data.previewUrl}`);
      
      lastSyncedFilesRef.current = filesHash;

      setSyncStatus({
        status: 'synced',
        lastSync: new Date(),
        previewUrl: data.previewUrl || null,
        deploymentId: data.deploymentId || null,
        deploymentStatus: data.status || 'READY',
        error: null,
      });

    } catch (err: any) {
      console.error('❌ Sync error:', err);
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        deploymentStatus: 'ERROR',
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
      syncToVercel();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectFiles, enabled, debounceMs, syncToVercel]);

  // Initial sync on mount
  useEffect(() => {
    if (enabled && Object.keys(projectFiles).length > 0) {
      syncToVercel();
    }
  }, [enabled]); // Only on enabled change, not every projectFiles change

  // Force immediate sync
  const forceSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    lastSyncedFilesRef.current = ''; // Reset to force update
    syncToVercel();
  }, [syncToVercel]);

  return {
    syncStatus,
    forceSync,
    previewUrl: syncStatus.previewUrl,
    deploymentId: syncStatus.deploymentId,
    deploymentStatus: syncStatus.deploymentStatus,
    isSyncing: syncStatus.status === 'syncing',
    syncError: syncStatus.error,
  };
}
