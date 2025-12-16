import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Version {
  id: string;
  number?: number;
  timestamp: number;
  message: string;
  isCurrent?: boolean;
}

interface UseProjectVersionsReturn {
  versions: Version[];
  isLoading: boolean;
  isRollingBack: boolean;
  fetchVersions: () => Promise<void>;
  rollbackToVersion: (versionId: string) => Promise<boolean>;
}

export function useProjectVersions(sessionId: string | undefined): UseProjectVersionsReturn {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Fetch Cloudflare Worker versions
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/worker-versions?sessionId=${sessionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch versions');
      }

      const result = await response.json();
      setVersions(result.versions || []);
    } catch (error: any) {
      console.error('Error fetching versions:', error);
      // Don't show toast for empty versions (Worker not deployed yet)
      if (error.message !== 'Worker not found') {
        toast.error('Erreur lors du chargement des versions');
      }
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const rollbackToVersion = useCallback(async (versionId: string): Promise<boolean> => {
    if (!sessionId) return false;

    setIsRollingBack(true);
    try {
      const { data, error } = await supabase.functions.invoke('worker-versions', {
        body: { sessionId, versionId },
      });

      if (error) throw error;

      toast.success(`Restauré vers la version`);
      await fetchVersions();
      return true;
    } catch (error: any) {
      console.error('Error rolling back:', error);
      toast.error('Erreur lors de la restauration');
      return false;
    } finally {
      setIsRollingBack(false);
    }
  }, [sessionId, fetchVersions]);

  return {
    versions,
    isLoading,
    isRollingBack,
    fetchVersions,
    rollbackToVersion,
  };
}
