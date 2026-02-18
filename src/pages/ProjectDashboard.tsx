import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Eye, BarChart3, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from '@/hooks/useTranslation';

interface ProjectData {
  id: string;
  title: string | null;
  project_type: string | null;
  created_at: string;
  updated_at: string;
  public_url: string | null;
  cloudflare_deployment_url: string | null;
  thumbnail_url: string | null;
}

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { isDark } = useThemeStore();
  const { language } = useTranslation();
  const isFr = language === 'fr';
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from('build_sessions')
        .select('id, title, project_type, created_at, updated_at, public_url, cloudflare_deployment_url, thumbnail_url')
        .eq('id', projectId)
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        variant: 'destructive',
        title: isFr ? 'Erreur' : 'Error',
        description: isFr ? 'Impossible de charger le projet' : 'Unable to load project',
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProject = () => {
    if (project?.project_type === 'webapp') {
      navigate(`/builder-app/${projectId}`);
    } else {
      navigate(`/builder/${projectId}`);
    }
  };

  const handleViewLive = () => {
    if (project?.public_url) {
      window.open(project.public_url, '_blank');
    } else if (project?.cloudflare_deployment_url) {
      window.open(project.cloudflare_deployment_url, '_blank');
    } else {
      toast({
        title: isFr ? 'Projet non publié' : 'Project not published',
        description: isFr ? "Ce projet n'a pas encore été publié." : 'This project has not been published yet.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-muted-foreground">{isFr ? 'Chargement...' : 'Loading...'}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{isFr ? 'Projet introuvable' : 'Project not found'}</p>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
            }}
          >
            {isFr ? 'Retour au tableau de bord' : 'Back to dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative">
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(rgba(3, 165, 192, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(3, 165, 192, 0.03) 1px, transparent 1px)'
            : 'linear-gradient(rgba(3, 165, 192, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(3, 165, 192, 0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="hover:text-[#03A5C0]"
            aria-label={isFr ? 'Retour au tableau de bord' : 'Back to dashboard'}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {project.title || (isFr ? 'Sans titre' : 'Untitled')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFr ? 'Créé le' : 'Created on'} {new Date(project.created_at).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Button
            onClick={handleEditProject}
            className="h-24 flex flex-col items-center justify-center gap-2"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
            }}
            variant="outline"
          >
            <Pencil className="h-6 w-6" />
            <span>{isFr ? 'Modifier le projet' : 'Edit project'}</span>
          </Button>

          <Button
            onClick={handleViewLive}
            className="h-24 flex flex-col items-center justify-center gap-2"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
            }}
            variant="outline"
          >
            <Eye className="h-6 w-6" />
            <span>{isFr ? 'Voir en ligne' : 'View live'}</span>
          </Button>

          <Button
            onClick={() => navigate(`/preview/${projectId}`)}
            className="h-24 flex flex-col items-center justify-center gap-2"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
            }}
            variant="outline"
          >
            <Globe className="h-6 w-6" />
            <span>{isFr ? 'Prévisualiser' : 'Preview'}</span>
          </Button>

          <Button
            onClick={() => toast({ title: isFr ? 'Bientôt disponible' : 'Coming soon', description: isFr ? 'Les analytics seront disponibles prochainement.' : 'Analytics will be available soon.' })}
            className="h-24 flex flex-col items-center justify-center gap-2"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
            }}
            variant="outline"
          >
            <BarChart3 className="h-6 w-6" />
            <span>Analytics</span>
          </Button>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{isFr ? 'Aperçu' : 'Preview'}</h2>
          {project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.title || (isFr ? 'Aperçu' : 'Preview')}
              className="w-full max-w-2xl rounded-lg border border-border/50"
            />
          ) : (
            <div className="w-full max-w-2xl h-48 bg-muted/30 rounded-lg border border-border/50 flex items-center justify-center">
              <span className="text-muted-foreground">{isFr ? 'Aucun aperçu disponible' : 'No preview available'}</span>
            </div>
          )}
        </div>

        <div className="mt-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{isFr ? 'Informations' : 'Information'}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 text-foreground">
                {project.project_type === 'webapp' ? (isFr ? 'Application Web' : 'Web App') : (isFr ? 'Site Web' : 'Website')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{isFr ? 'Dernière modification:' : 'Last modified:'}</span>
              <span className="ml-2 text-foreground">
                {new Date(project.updated_at).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')}
              </span>
            </div>
            {project.public_url && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{isFr ? 'URL publique:' : 'Public URL:'}</span>
                <a
                  href={project.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-[#03A5C0] hover:underline"
                >
                  {project.public_url}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
