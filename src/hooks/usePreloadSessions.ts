/**
 * Smart preloading hook for recent sessions
 * Loads frequently used projects in the background
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IndexedDBCache } from '@/services/indexedDBCache';
import { parseProjectFiles } from '@/lib/projectFilesParser';

interface PreloadedSession {
  sessionId: string;
  projectFiles: Record<string, string>;
  title: string;
  lastAccessed: number;
}

export function usePreloadSessions() {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedSessions, setPreloadedSessions] = useState<PreloadedSession[]>([]);
  const [cacheHitRate, setCacheHitRate] = useState(0);

  /**
   * Preload recent sessions on login
   */
  const preloadRecentSessions = useCallback(async (limit: number = 5) => {
    setIsPreloading(true);

    try {
      console.log('🔄 Preloading recent sessions...');

      // 1. Load from IndexedDB first (local cache)
      const cachedProjects = await IndexedDBCache.getRecentProjects(limit);
      
      if (cachedProjects.length > 0) {
        console.log(`📦 Loaded ${cachedProjects.length} sessions from cache`);
        setPreloadedSessions(
          cachedProjects.map(p => ({
            sessionId: p.sessionId,
            projectFiles: p.projectFiles,
            title: '',
            lastAccessed: p.lastModified
          }))
        );
      }

      // 2. Fetch from Supabase in the background
      const { data: sessions, error } = await supabase
        .from('build_sessions')
        .select('id, title, project_files, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        console.log(`🌐 Fetched ${sessions.length} sessions from Supabase`);

        // Parse files with the correct format
        const parsedSessions = sessions.map(session => ({
          ...session,
          parsedFiles: parseProjectFiles(session.project_files)
        }));

        // Update the IndexedDB cache
        await Promise.all(
          parsedSessions.map(session =>
            IndexedDBCache.saveProject(
              session.id,
              session.parsedFiles,
              'synced'
            )
          )
        );

        setPreloadedSessions(
          parsedSessions.map(s => ({
            sessionId: s.id,
            projectFiles: s.parsedFiles,
            title: s.title || 'Untitled',
            lastAccessed: new Date(s.updated_at).getTime()
          }))
        );

        // Calculate the cache hit rate
        const cacheHits = cachedProjects.filter(cp =>
          sessions.some(s => s.id === cp.sessionId)
        ).length;
        setCacheHitRate((cacheHits / sessions.length) * 100);
      }

    } catch (error) {
      console.error('Error preloading sessions:', error);
    } finally {
      setIsPreloading(false);
    }
  }, []);

  /**
   * Get a preloaded session
   */
  const getPreloadedSession = useCallback((sessionId: string): PreloadedSession | null => {
    return preloadedSessions.find(s => s.sessionId === sessionId) || null;
  }, [preloadedSessions]);

  /**
   * Preload a specific session
   */
  const preloadSession = useCallback(async (sessionId: string) => {
    try {
      // Check the cache first
      const cached = await IndexedDBCache.getProject(sessionId);
      if (cached) {
        console.log(`📦 Session ${sessionId} loaded from cache`);
        return cached.projectFiles;
      }

      // Otherwise fetch from Supabase
      const { data: session, error } = await supabase
        .from('build_sessions')
        .select('id, title, project_files')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      if (session) {
        // Parse files with the correct format
        const projectFiles = parseProjectFiles(session.project_files);

        // Save to cache
        await IndexedDBCache.saveProject(sessionId, projectFiles, 'synced');
        
        console.log(`🌐 Session ${sessionId} fetched and cached`);
        return projectFiles;
      }

      return null;
    } catch (error) {
      console.error('Error preloading session:', error);
      return null;
    }
  }, []);

  /**
   * Clean up old projects from cache
   */
  const cleanupCache = useCallback(async (daysOld: number = 30) => {
    try {
      const deleted = await IndexedDBCache.cleanOldProjects(daysOld);
      console.log(`🧹 Cleaned ${deleted} old projects from cache`);
      return deleted;
    } catch (error) {
      console.error('Error cleaning cache:', error);
      return 0;
    }
  }, []);

  /**
   * Get the cache size
   */
  const getCacheSize = useCallback(async () => {
    try {
      const sizeMB = await IndexedDBCache.getCacheSize();
      return sizeMB;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }, []);

  /**
   * Automatically preload on mount
   */
  useEffect(() => {
    // Preload after a short delay to avoid blocking the initial render
    const timeout = setTimeout(() => {
      preloadRecentSessions(5);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [preloadRecentSessions]);

  return {
    isPreloading,
    preloadedSessions,
    cacheHitRate,
    getPreloadedSession,
    preloadSession,
    preloadRecentSessions,
    cleanupCache,
    getCacheSize
  };
}
