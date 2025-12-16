import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Version {
  id: string;
  timestamp: number;
  message: string;
  filesCount: number;
}

interface UseProjectVersionsReturn {
  versions: Version[];
  isLoading: boolean;
  isRollingBack: boolean;
  fetchVersions: () => Promise<void>;
  createVersion: (message: string) => Promise<boolean>;
  rollbackToVersion: (versionId: string) => Promise<Record<string, string> | null>;
}

export function useProjectVersions(sessionId: string | undefined): UseProjectVersionsReturn {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('project-versions', {
        method: 'GET',
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // For GET requests, we need to use query params via the URL
      // But supabase.functions.invoke doesn't support query params directly
      // So we'll use a workaround with POST and action type
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-versions?sessionId=${sessionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }

      const result = await response.json();
      setVersions(result.versions || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
      toast.error('Erreur lors du chargement des versions');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const createVersion = useCallback(async (message: string): Promise<boolean> => {
    if (!sessionId) return false;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('project-versions', {
        body: { sessionId, message },
      });

      if (error) throw error;

      toast.success('Version créée');
      await fetchVersions();
      return true;
    } catch (error) {
      console.error('Error creating version:', error);
      toast.error('Erreur lors de la création de la version');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, fetchVersions]);

  const rollbackToVersion = useCallback(async (versionId: string): Promise<Record<string, string> | null> => {
    if (!sessionId) return null;

    setIsRollingBack(true);
    try {
      const { data, error } = await supabase.functions.invoke('project-rollback', {
        body: { sessionId, versionId },
      });

      if (error) throw error;

      toast.success(`Restauré vers ${versionId}`);
      await fetchVersions();
      return data.files as Record<string, string>;
    } catch (error) {
      console.error('Error rolling back:', error);
      toast.error('Erreur lors de la restauration');
      return null;
    } finally {
      setIsRollingBack(false);
    }
  }, [sessionId, fetchVersions]);

  return {
    versions,
    isLoading,
    isRollingBack,
    fetchVersions,
    createVersion,
    rollbackToVersion,
  };
}
