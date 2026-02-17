import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Eye, Settings, BarChart3, Code, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
        title: 'Erreur',
        description: 'Impossible de charger le projet',
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
        title: 'Projet non publié',
        description: 'Ce projet n\'a pas encore été publié.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Projet introuvable</p>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)',
            }}
          >
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative">
      {/* Background avec cadrillage */}
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
        {/* Header avec retour */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="hover:text-[#03A5C0]"
            aria-label="Retour au tableau de bord"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {project.title || 'Sans titre'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Actions principales */}
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
            <span>Modifier le projet</span>
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
            <span>Voir en ligne</span>
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
            <span>Prévisualiser</span>
          </Button>

          <Button
            onClick={() => toast({ title: 'Bientôt disponible', description: 'Les analytics seront disponibles prochainement.' })}
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

        {/* Aperçu du projet */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Aperçu</h2>
          {project.thumbnail_url ? (
            <img 
              src={project.thumbnail_url} 
              alt={project.title || 'Aperçu'} 
              className="w-full max-w-2xl rounded-lg border border-border/50"
            />
          ) : (
            <div className="w-full max-w-2xl h-48 bg-muted/30 rounded-lg border border-border/50 flex items-center justify-center">
              <span className="text-muted-foreground">Aucun aperçu disponible</span>
            </div>
          )}
        </div>

        {/* Informations du projet */}
        <div className="mt-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Informations</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 text-foreground">
                {project.project_type === 'webapp' ? 'Application Web' : 'Site Web'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Dernière modification:</span>
              <span className="ml-2 text-foreground">
                {new Date(project.updated_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
            {project.public_url && (
              <div className="col-span-2">
                <span className="text-muted-foreground">URL publique:</span>
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
