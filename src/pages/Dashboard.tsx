import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ExternalLink, Trash2, Edit, Monitor, Globe, Smartphone, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface Website {
  id: string;
  title: string;
  cloudflare_url: string | null;
  created_at: string;
  html_content?: string;
}

interface BuildSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  html_content?: string;
}

type ProjectType = 'website' | 'webapp' | 'mobile';

interface Project {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  status: 'draft' | 'published';
  url?: string | null;
  type: ProjectType;
  thumbnail?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const getProjectType = (htmlContent?: string): ProjectType => {
    if (!htmlContent) return 'website';
    const lower = htmlContent.toLowerCase();
    if (lower.includes('mobile') || lower.includes('app mobile')) return 'mobile';
    if (lower.includes('webapp') || lower.includes('application')) return 'webapp';
    return 'website';
  };

  const getProjectIcon = (type: ProjectType) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'webapp':
        return <LayoutDashboard className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    checkAuth();
    loadProjects();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUserEmail(session.user.email || "");
  };

  const loadProjects = async () => {
    try {
      const [websitesResult, sessionsResult] = await Promise.all([
        supabase
          .from("websites")
          .select("id, title, cloudflare_url, created_at, html_content")
          .order("created_at", { ascending: false }),
        supabase
          .from("build_sessions")
          .select("id, title, created_at, updated_at, project_files, project_type")
          .order("updated_at", { ascending: false })
      ]);

      if (websitesResult.error) throw websitesResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      const publishedProjects: Project[] = (websitesResult.data || []).map(w => ({
        id: w.id,
        title: w.title,
        created_at: w.created_at,
        status: 'published' as const,
        url: w.cloudflare_url,
        type: getProjectType(w.html_content),
      }));

      const draftProjects: Project[] = (sessionsResult.data || []).map(s => {
        const projectFilesData = s.project_files as any;
        let htmlContent = '';
        
        if (projectFilesData && Array.isArray(projectFilesData)) {
          const indexFile = projectFilesData.find((f: any) => f.path === 'index.html');
          htmlContent = indexFile?.content || '';
        }
        
        return {
          id: s.id,
          title: s.title || "Sans titre",
          created_at: s.created_at,
          updated_at: s.updated_at,
          status: 'draft' as const,
          type: getProjectType(htmlContent),
        };
      });

      setProjects([...draftProjects, ...publishedProjects]);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des projets");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${project.title}" ?`)) return;

    try {
      const table = project.status === 'published' ? 'websites' : 'build_sessions';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", project.id);

      if (error) throw error;
      toast.success("Projet supprimé");
      loadProjects();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-black">
                Mes projets
              </h1>
              <p className="text-slate-600 mt-2">{userEmail}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate("/builder")} 
                variant="ghost"
                className="text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
                style={{ 
                  color: '#014AAD',
                  borderColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(1, 74, 173, 0.3)';
                  e.currentTarget.style.backgroundColor = 'rgba(1, 74, 173, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Créer un projet
              </Button>
              <Button 
                onClick={handleLogout} 
                variant="ghost"
                className="text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
                style={{ 
                  color: '#014AAD',
                  borderColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(1, 74, 173, 0.3)';
                  e.currentTarget.style.backgroundColor = 'rgba(1, 74, 173, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Déconnexion
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-600">Chargement...</p>
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-slate-600 mb-4">Aucun projet pour le moment</p>
                <Button onClick={() => navigate("/builder")}>
                  Créer votre premier projet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow relative overflow-hidden">
                  {/* Type icon in corner */}
                  <div className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-lg">
                    {getProjectIcon(project.type)}
                  </div>

                  {/* Thumbnail placeholder */}
                  <div className="w-full h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <Globe className="w-12 h-12 text-slate-400" />
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl line-clamp-1">{project.title}</CardTitle>
                      <Badge variant={project.status === 'published' ? 'default' : 'secondary'}>
                        {project.status === 'published' ? 'Publié' : 'Brouillon'}
                      </Badge>
                    </div>
                    <CardDescription>
                      Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {/* Edit button */}
                      <Button
                        variant="outline"
                        className="flex-1"
                        size="sm"
                        onClick={() => {
                          if (project.status === 'draft') {
                            navigate(`/builder/${project.id}`);
                          } else {
                            toast.info("Édition des sites publiés bientôt disponible");
                          }
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Éditer
                      </Button>

                      {/* View button - only for published */}
                      {project.status === 'published' && project.url && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          size="sm"
                          asChild
                        >
                          <a href={project.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Voir
                          </a>
                        </Button>
                      )}
                    </div>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDeleteProject(project)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
