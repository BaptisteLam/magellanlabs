import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function SessionPreview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;

      try {
        const { data, error } = await supabase
          .from('build_sessions')
          .select('project_files, project_type')
          .eq('id', sessionId)
          .single();

        if (error) throw error;

        if (data) {
          const projectFilesData = data.project_files as any;
          
          // Support des deux formats: array ET object
          let files: any[] = [];
          if (Array.isArray(projectFilesData)) {
            files = projectFilesData;
          } else if (typeof projectFilesData === 'object' && projectFilesData !== null) {
            // Convertir object en array
            files = Object.entries(projectFilesData).map(([path, content]) => ({
              path,
              content
            }));
          }
          
          // Pour les sites web statiques, trouver index.html
          if (data.project_type === 'website') {
            const indexFile = files.find(f => f.path === 'index.html');
            if (indexFile) {
              setHtml(indexFile.content);
            }
          } else {
            // Pour les webapps React, on ne peut pas les afficher directement
            // Afficher un message d'erreur
            setHtml('<html><body><h1>React apps cannot be previewed directly</h1></body></html>');
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
        setHtml('<html><body><h1>Error loading session</h1></body></html>');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  if (loading) {
    return <div>Loading...</div>;
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
