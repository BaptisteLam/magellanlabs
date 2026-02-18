import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from '@/hooks/useTranslation';

export default function SessionPreview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { language } = useTranslation();
  const isFr = language === 'fr';
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;

      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) {
          navigate('/auth');
          return;
        }

        const { data, error } = await supabase
          .from('build_sessions')
          .select('project_files, project_type')
          .eq('id', sessionId)
          .eq('user_id', authSession.user.id)
          .single();

        if (error) throw error;

        if (data) {
          const projectFilesData = data.project_files as any;

          let files: any[] = [];
          if (Array.isArray(projectFilesData)) {
            files = projectFilesData;
          } else if (typeof projectFilesData === 'object' && projectFilesData !== null) {
            files = Object.entries(projectFilesData).map(([path, content]) => ({
              path,
              content
            }));
          }

          if (data.project_type === 'website') {
            const indexFile = files.find(f => f.path === 'index.html');
            if (indexFile) {
              setHtml(indexFile.content);
            }
          } else {
            setHtml(`<html><body><h1>${isFr ? 'Les applications React ne peuvent pas être prévisualisées directement' : 'React apps cannot be previewed directly'}</h1></body></html>`);
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
        setHtml(`<html><body><h1>${isFr ? 'Erreur lors du chargement de la session' : 'Error loading session'}</h1></body></html>`);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  if (loading) {
    return <div>{isFr ? 'Chargement...' : 'Loading...'}</div>;
  }

  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title="Session Preview"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
