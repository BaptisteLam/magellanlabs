import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ExternalLink, Trash2, LogOut, Globe } from "lucide-react";
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Mes Sites Web
              </h1>
              <p className="text-slate-600 mt-2">{userEmail}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/builder")} variant="outline">
                <Globe className="w-4 h-4 mr-2" />
                Créer un site
              </Button>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
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
                        <CardContent className="space-y-3">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate(`/builder/${session.id}`)}
                          >
                            Continuer l'édition
                          </Button>
                          <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
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
                        <CardContent className="space-y-3">
                          {website.cloudflare_url && (
                            <a
                              href={website.cloudflare_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <Button variant="outline" className="w-full">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Voir le site
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => handleDeleteWebsite(website.id)}
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
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
