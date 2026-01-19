import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Eye, ExternalLink } from 'lucide-react';
import { E2BPreview } from '@/components/E2BPreview';
import { useSubdomain } from '@/hooks/useSubdomain';

interface ProjectData {
  id: string;
  title: string;
  project_files: Record<string, string>;
  project_type: 'website' | 'webapp' | 'mobile';
  created_at: string;
  view_count: number;
}

export default function PublicProject() {
  const { subdomain: subdomainParam } = useParams<{ subdomain: string }>();
  const subdomainFromUrl = useSubdomain();
  
  // Utiliser le subdomain depuis l'URL hostname si disponible, sinon depuis les params
  const subdomain = subdomainFromUrl || subdomainParam;
  
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicProject();
  }, [subdomain]);

  const loadPublicProject = async () => {
    if (!subdomain) {
      setError('Sous-domaine manquant');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Loading public project:', subdomain);

      // Récupérer le projet publié
      const { data: publishedProject, error: publishedError } = await supabase
        .from('published_projects')
        .select('build_session_id, view_count')
        .eq('subdomain', subdomain)
        .maybeSingle();

      if (publishedError) {
        console.error('❌ Database error:', publishedError);
        setError('Erreur de base de données');
        setLoading(false);
        return;
      }

      if (!publishedProject) {
        console.error('❌ Project not found for subdomain:', subdomain);
        setError('Projet non trouvé');
        setLoading(false);
        return;
      }

      // Récupérer les détails de la session
      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .select('id, title, project_files, project_type, created_at')
        .eq('id', publishedProject.build_session_id)
        .maybeSingle();

      if (sessionError) {
        console.error('❌ Database error:', sessionError);
        setError('Erreur de base de données');
        setLoading(false);
        return;
      }

      if (!session) {
        console.error('❌ Session not found');
        setError('Session non trouvée');
        setLoading(false);
        return;
      }

      // Parser les fichiers de projet
      let projectFiles: Record<string, string> = {};
      if (session.project_files && Array.isArray(session.project_files)) {
        session.project_files.forEach((file: any) => {
          if (file.path && file.content) {
            projectFiles[file.path] = file.content;
          }
        });
      }

      setProject({
        id: session.id,
        title: session.title || 'Projet sans titre',
        project_files: projectFiles,
        project_type: (session.project_type as 'website' | 'webapp' | 'mobile') || 'website',
        created_at: session.created_at,
        view_count: publishedProject.view_count || 0
      });

      // Incrémenter le compteur de vues
      await supabase.rpc('increment_view_count', { 
        project_subdomain: subdomain 
      });

      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading project:', err);
      setError('Erreur lors du chargement du projet');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#03A5C0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg">Chargement du projet...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">😕</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Projet non trouvé</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white transition-all"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.9)',
              color: 'white'
            }}
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/lovable-uploads/magellan-logo-light.png" 
                alt="Magellan" 
                className="h-8"
              />
              <div className="h-6 w-px bg-slate-300"></div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{project.title}</h1>
                <p className="text-sm text-slate-500">
                  Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Eye className="w-5 h-5" />
                <span className="text-sm font-medium">{project.view_count} vues</span>
              </div>
              
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  borderColor: 'rgb(3,165,192)',
                  backgroundColor: 'rgba(3,165,192,0.1)',
                  color: 'rgb(3,165,192)',
                  border: '1px solid'
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Créer mon site
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Preview */}
      <main className="w-full h-[calc(100vh-80px)]">
        <E2BPreview
          projectFiles={project.project_files}
          previewMode="desktop"
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-slate-600">
            Propulsé par <span className="font-semibold text-[#03A5C0]">Magellan</span> - 
            Créateur de sites web IA
          </p>
        </div>
      </footer>
    </div>
  );
}
