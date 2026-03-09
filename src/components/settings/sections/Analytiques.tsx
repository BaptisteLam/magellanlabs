import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useThemeStore } from '@/stores/themeStore';
import CloudflareAnalytics from '@/components/CloudflareAnalytics';

export function Analytiques() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { isDark } = useThemeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    } else {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const { data: projectData } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      setProject(projectData);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          <p className="text-muted-foreground">Select a project to view statistics</p>
        </div>
        <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            No project selected
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          <p className="text-muted-foreground">Loading data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!project?.web_analytics_site_token) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          <p className="text-muted-foreground">{project?.title || 'Project'}</p>
        </div>
        <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Analytics not configured</p>
            <p className="text-sm mt-2">Publish your site to enable analytics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <p className="text-muted-foreground">{project?.title || 'Project'}</p>
      </div>
      
      <div className="rounded-xl overflow-hidden border border-border/50">
        <CloudflareAnalytics sessionId={projectId} isDark={isDark} />
      </div>
    </div>
  );
}
