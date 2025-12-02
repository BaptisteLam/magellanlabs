import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectArchitecture {
  framework: string;
  patterns: string[];
  conventions: Record<string, string>;
}

export interface RecentChange {
  timestamp: string;
  description: string;
  filesAffected: string[];
  lessons: string[];
}

export interface KnownIssue {
  issue: string;
  solution: string;
  frequency: number;
}

export interface UserPreferences {
  codingStyle: string;
  preferredLibraries: string[];
  avoidances: string[];
}

export interface ProjectMemory {
  sessionId: string;
  architecture: ProjectArchitecture;
  recentChanges: RecentChange[];
  knownIssues: KnownIssue[];
  userPreferences: UserPreferences;
}

export interface CodeChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  description: string;
}

export function useProjectMemory(sessionId: string | undefined) {
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke('memory', {
        body: { action: 'load', sessionId }
      });

      if (functionError) throw functionError;

      setMemory(data.memory);
    } catch (err) {
      console.error('Load memory error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const buildContextWithMemory = useCallback(async (prompt: string): Promise<string | null> => {
    if (!sessionId) return null;

    try {
      const { data, error: functionError } = await supabase.functions.invoke('memory', {
        body: { action: 'build_context', sessionId, prompt }
      });

      if (functionError) throw functionError;

      return data.context;
    } catch (err) {
      console.error('Build context error:', err);
      return null;
    }
  }, [sessionId]);

  const updateMemory = useCallback(async (changes: CodeChange[], errors: any[] = []) => {
    if (!sessionId) return;

    try {
      const { data, error: functionError } = await supabase.functions.invoke('memory', {
        body: { action: 'update', sessionId, changes, errors }
      });

      if (functionError) throw functionError;

      setMemory(data.memory);
      return data.memory;
    } catch (err) {
      console.error('Update memory error:', err);
      throw err;
    }
  }, [sessionId]);

  const initializeMemory = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error: functionError } = await supabase.functions.invoke('memory', {
        body: { action: 'init', sessionId }
      });

      if (functionError) throw functionError;

      setMemory(data.memory);
      return data.memory;
    } catch (err) {
      console.error('Initialize memory error:', err);
      throw err;
    }
  }, [sessionId]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  return {
    memory,
    isLoading,
    error,
    loadMemory,
    buildContextWithMemory,
    updateMemory,
    initializeMemory
  };
}