import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, Eye, Globe, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsData {
  visitors: number;
  pageViews: number;
  topPages: { path: string; views: number }[];
  countries: { country: string; visits: number }[];
}

export function Analytiques() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectAndAnalytics();
    } else {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchProjectAndAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch project to get web_analytics_site_token
      const { data: projectData } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      setProject(projectData);

      if (projectData?.web_analytics_site_token) {
        // Fetch analytics from Cloudflare
        const { data: analyticsData, error } = await supabase.functions.invoke('get-cloudflare-analytics', {
          body: { siteToken: projectData.web_analytics_site_token }
        });

        if (!error && analyticsData) {
          setAnalytics(analyticsData);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytiques</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour voir les statistiques</p>
        </div>
        <Card className="rounded-[8px]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun projet sélectionné
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analytiques</h2>
        <p className="text-muted-foreground">Suivez les performances de votre site</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !project?.web_analytics_site_token ? (
        <Card className="rounded-[8px]">
          <CardContent className="py-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Analytiques non configurées</p>
            <p className="text-sm mt-2">Publiez votre site pour activer les analytiques</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-[8px]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Visiteurs</p>
                    <p className="text-2xl font-bold">{analytics?.visitors || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[#03A5C0]/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-[#03A5C0]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pages vues</p>
                    <p className="text-2xl font-bold">{analytics?.pageViews || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[#03A5C0]/20 flex items-center justify-center">
                    <Eye className="h-6 w-6 text-[#03A5C0]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pays</p>
                    <p className="text-2xl font-bold">{analytics?.countries?.length || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[#03A5C0]/20 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-[#03A5C0]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Pages */}
          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pages les plus visitées
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.topPages && analytics.topPages.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-mono text-sm">{page.path}</span>
                      <span className="font-bold">{page.views} vues</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucune donnée de pages disponible</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Countries */}
          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Origine géographique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.countries && analytics.countries.length > 0 ? (
                <div className="space-y-3">
                  {analytics.countries.map((country, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <span>{country.country}</span>
                      <span className="font-bold">{country.visits} visites</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucune donnée géographique disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
