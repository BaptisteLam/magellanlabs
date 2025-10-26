import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface Website {
  id: string;
  title: string;
  cloudflare_url: string | null;
  created_at: string;
}

interface BuildSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [buildSessions, setBuildSessions] = useState<BuildSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    checkAuth();
    loadWebsites();
    loadBuildSessions();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUserEmail(session.user.email || "");
  };

  const loadWebsites = async () => {
    try {
      const { data, error } = await supabase
        .from("websites")
        .select("id, title, cloudflare_url, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebsites(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des sites");
    } finally {
      setLoading(false);
    }
  };

  const loadBuildSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("build_sessions")
        .select("id, title, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setBuildSessions(data || []);
    } catch (error: any) {
      console.error("Erreur lors du chargement des sessions:", error);
    }
  };

  const handleDeleteWebsite = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce site ?")) return;

    try {
      const { error } = await supabase
        .from("websites")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Site supprimé");
      loadWebsites();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce brouillon ?")) return;

    try {
      const { error } = await supabase
        .from("build_sessions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Brouillon supprimé");
      loadBuildSessions();
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
          ) : (
            <>
              {/* Brouillons */}
              {buildSessions.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 text-slate-800">Brouillons en cours</h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {buildSessions.map((session) => (
                      <Card key={session.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="text-xl">{session.title || "Sans titre"}</CardTitle>
                          <CardDescription>
                            Modifié le {new Date(session.updated_at).toLocaleDateString('fr-FR')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-2 items-center">
                          <Button
                            variant="ghost"
                            className="flex-1 text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
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
                            onClick={() => navigate(`/builder/${session.id}`)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 hover:bg-red-50"
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Sites déployés */}
              <div>
                <h2 className="text-2xl font-bold mb-4 text-slate-800">Sites déployés</h2>
                {websites.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-slate-600 mb-4">Aucun site déployé pour le moment</p>
                      <Button onClick={() => navigate("/builder")}>
                        Créer votre premier site
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {websites.map((website) => (
                      <Card key={website.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="text-xl">{website.title}</CardTitle>
                          <CardDescription>
                            Créé le {new Date(website.created_at).toLocaleDateString('fr-FR')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-2 items-center">
                          {website.cloudflare_url && (
                            <a
                              href={website.cloudflare_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1"
                            >
                              <Button 
                                variant="ghost" 
                                className="w-full text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
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
                                <ExternalLink className="w-4 h-4" />
                                Voir le site
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 hover:bg-red-50"
                            onClick={() => handleDeleteWebsite(website.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
