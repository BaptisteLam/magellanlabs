import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';

export interface BuildSessionData {
  id: string;
  title: string;
  projectFiles: Record<string, string>;
  projectType: 'website' | 'webapp' | 'mobile';
  cloudflareProjectName?: string;
  deployedUrl?: string;
  gaPropertyId?: string;
  websiteId?: string;
}

export function useBuildSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState<BuildSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      // Récupérer les données website associées
      const { data: websiteData } = await supabase
        .from('build_sessions')
        .select('website_id, websites!inner(id, netlify_url, ga_property_id)')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('Error loading session:', error);
        sonnerToast.error('Session introuvable');
        navigate('/builder');
        return;
      }

      if (data) {
        // Parser les fichiers du projet
        let filesMap: Record<string, string> = {};
        const projectFilesData = data.project_files as any;

        if (projectFilesData) {
          if (Array.isArray(projectFilesData) && projectFilesData.length > 0) {
            projectFilesData.forEach((file: any) => {
              if (file.path && file.content) {
                filesMap[file.path] = file.content;
              }
            });
          } else if (typeof projectFilesData === 'object' && Object.keys(projectFilesData).length > 0) {
            filesMap = projectFilesData;
          }
        }

        const website = Array.isArray(websiteData?.websites) 
          ? websiteData.websites[0] 
          : websiteData?.websites;

        setSessionData({
          id: data.id,
          title: data.title || '',
          projectFiles: filesMap,
          projectType: (data.project_type as 'website' | 'webapp' | 'mobile') || 'website',
          cloudflareProjectName: data.cloudflare_project_name || undefined,
          deployedUrl: website?.netlify_url || undefined,
          gaPropertyId: website?.ga_property_id || undefined,
          websiteId: website?.id || undefined,
        });
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = async (updates: Partial<BuildSessionData>, messages?: any[]) => {
    if (!sessionId || !sessionData) return;

    setIsSaving(true);
    try {
      const filesArray = Object.entries(updates.projectFiles || sessionData.projectFiles).map(
        ([path, content]) => ({
          path,
          content,
          type: path.endsWith('.html') ? 'html' 
              : path.endsWith('.css') ? 'stylesheet' 
              : path.endsWith('.js') ? 'javascript' 
              : 'text'
        })
      );

      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesArray,
          messages: messages as any,
          title: updates.title || sessionData.title,
          project_type: updates.projectType || sessionData.projectType,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Publier automatiquement le projet
      if (sessionData.title && Object.keys(sessionData.projectFiles).length > 0) {
        try {
          await supabase.functions.invoke('publish-project', {
            body: { sessionId }
          });
        } catch (publishErr) {
          console.error('Error publishing project:', publishErr);
        }
      }

      // Mettre à jour le state local
      setSessionData(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    sessionId,
    sessionData,
    isLoading,
    isSaving,
    loadSession,
    saveSession,
    setSessionData
  };
}
