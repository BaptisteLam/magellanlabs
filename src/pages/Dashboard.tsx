import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ExternalLink, Trash2, Edit, Monitor, Globe, Smartphone, LayoutDashboard, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useThemeStore } from '@/stores/themeStore';

interface Website {
  id: string;
  title: string;
  netlify_url: string | null;
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
  const { isDark } = useThemeStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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
          .select("id, title, netlify_url, created_at, html_content, thumbnail_url")
          .order("created_at", { ascending: false }),
        supabase
          .from("build_sessions")
          .select("id, title, created_at, updated_at, project_files, project_type, thumbnail_url")
          .order("updated_at", { ascending: false })
      ]);

      if (websitesResult.error) throw websitesResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      const publishedProjects: Project[] = (websitesResult.data || []).map(w => ({
        id: w.id,
        title: w.title,
        created_at: w.created_at,
        status: 'published' as const,
        url: w.netlify_url,
        type: getProjectType(w.html_content),
        thumbnail: w.thumbnail_url,
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
          thumbnail: s.thumbnail_url,
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

  const handleStartEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingTitle(project.title);
  };

  const handleSaveTitle = async (project: Project) => {
    if (!editingTitle.trim()) {
      toast.error("Le titre ne peut pas être vide");
      return;
    }

    try {
      const table = project.status === 'published' ? 'websites' : 'build_sessions';
      const { error } = await supabase
        .from(table)
        .update({ title: editingTitle.trim() })
        .eq("id", project.id);

      if (error) throw error;
      
      toast.success("Titre modifié");
      setEditingProjectId(null);
      loadProjects();
    } catch (error: any) {
      toast.error("Erreur lors de la modification");
    }
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditingTitle("");
  };

  return (
    <>
      <Header />
      <div className={`relative min-h-screen pt-20 pb-12 transition-colors ${isDark ? 'bg-[#1F1F20]' : 'bg-white'}`}>
        {/* Grid background */}
        <div className="absolute inset-0" 
             style={{ 
               backgroundImage: `linear-gradient(${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(148, 163, 184, 0.15)'} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(148, 163, 184, 0.15)'} 1px, transparent 1px)`,
               backgroundSize: '80px 80px'
             }} 
        />
        
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                Mes projets
              </h1>
              <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{userEmail}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate("/builder")} 
                variant="ghost"
                className={`text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2 ${isDark ? 'text-white' : 'text-black'}`}
                style={{ 
                  borderColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#03A5C0';
                  e.currentTarget.style.borderColor = 'rgba(3, 165, 192, 0.3)';
                  e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = isDark ? '#ffffff' : '#000000';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Créer un projet
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Chargement...</p>
            </div>
          ) : projects.length === 0 ? (
            <Card className={isDark ? 'border-slate-700' : ''} style={isDark ? { backgroundColor: '#181818' } : {}}>
              <CardContent className="py-12 text-center">
                <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Aucun projet pour le moment</p>
                <Button onClick={() => navigate("/builder")}>
                  Créer votre premier projet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className={`hover:shadow-lg transition-shadow relative overflow-hidden ${isDark ? 'border-slate-700' : ''}`} style={isDark ? { backgroundColor: '#181818' } : {}}>
                  {/* Type icon in corner */}
                  <div className={`absolute top-3 right-3 z-10 backdrop-blur-sm p-2 rounded-lg ${isDark ? 'bg-slate-700/80' : 'bg-background/80'}`}>
                    {getProjectIcon(project.type)}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-full h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                    {project.thumbnail ? (
                      <img 
                        src={project.thumbnail} 
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Globe className="w-12 h-12 text-slate-400" />
                    )}
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      {editingProjectId === project.id ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(project);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className={`flex-1 px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveTitle(project)}
                            className="h-8 w-8 p-0"
                          >
                            ✓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="h-8 w-8 p-0"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            onClick={() => handleStartEdit(project)}
                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${isDark ? 'hover:bg-slate-700' : ''}`}
                          >
                            <Pencil className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                          </button>
                          <CardTitle className="text-xl line-clamp-1">{project.title}</CardTitle>
                        </div>
                      )}
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
                        className="flex-1 transition-colors hover:bg-[#03A5C0] hover:text-white hover:border-[#03A5C0]"
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
