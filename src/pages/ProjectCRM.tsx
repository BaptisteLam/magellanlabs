/**
 * ProjectCRM - Page principale du CRM
 * Affiche la sidebar avec modules et le ModuleViewer
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CRMSidebar } from '@/components/crm/CRMSidebar';
import { ModuleViewer } from '@/components/crm/ModuleViewer';
import { CRMChatPanel } from '@/components/crm/CRMChatPanel';
import { TemplateGallery } from '@/components/crm/TemplateGallery';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sun, Moon, Grid } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectCRM() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      checkProjectAccess();
    }
  }, [projectId]);

  const checkProjectAccess = async () => {
    setIsLoading(true);
    try {
      // Vérifier l'authentification
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session) {
        toast.error('Vous devez être connecté');
        navigate('/auth');
        return;
      }

      // Récupérer le projet
      const { data: project, error: projectError } = await supabase
        .from('build_sessions')
        .select('id, title, business_sector, user_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        toast.error('Projet introuvable');
        navigate('/dashboard');
        return;
      }

      // Vérifier que l'user est propriétaire
      if (project.user_id !== session.user.id) {
        toast.error('Accès non autorisé');
        navigate('/dashboard');
        return;
      }

      setProjectTitle(project.title || 'Mon Projet');

      // Si pas de business_sector, c'est que le CRM n'a pas été généré
      if (!project.business_sector) {
        toast.warning('CRM non généré', {
          description: 'Générez d\'abord votre site web',
          action: {
            label: 'Retour',
            onClick: () => navigate(`/builder/${projectId}`)
          }
        });
      }
    } catch (error) {
      console.error('[ProjectCRM] Error:', error);
      toast.error('Erreur lors du chargement');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#03A5C0] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement du CRM...</p>
        </div>
      </div>
    );
  }

  if (!projectId) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
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

      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/builder/${projectId}`)}
            className="hover:text-[#03A5C0]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-lg font-semibold text-foreground">{projectTitle}</h1>
            <p className="text-xs text-muted-foreground">CRM / ERP</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Template Gallery Button */}
          {selectedModuleId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTemplateGalleryOpen(true)}
              className="border-[#03A5C0]/30 hover:bg-[#03A5C0]/10 hover:text-[#03A5C0] hover:border-[#03A5C0]"
            >
              <Grid className="h-4 w-4 mr-2" />
              Templates
            </Button>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hover:text-[#03A5C0]"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* TODO Phase 3: Bouton Chat Flottant */}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <CRMSidebar
          projectId={projectId}
          currentModuleId={selectedModuleId}
          onModuleSelect={setSelectedModuleId}
        />

        {/* Module Content */}
        <main className="flex-1 overflow-auto">
          {selectedModuleId ? (
            <ModuleViewer key={refreshKey} moduleId={selectedModuleId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-full bg-[#03A5C0]/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-[#03A5C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Bienvenue dans votre CRM
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un module dans la sidebar pour commencer
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Chat Panel pour créer des widgets dynamiquement */}
      <CRMChatPanel
        projectId={projectId}
        currentModuleId={selectedModuleId}
        onWidgetCreated={(widgetId) => {
          console.log('Widget created:', widgetId);
          // Rafraîchir la vue des widgets
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* Template Gallery pour installer des widgets préconfigurés */}
      {selectedModuleId && (
        <TemplateGallery
          open={isTemplateGalleryOpen}
          onOpenChange={setIsTemplateGalleryOpen}
          moduleId={selectedModuleId}
          onTemplatesInstalled={() => {
            // Rafraîchir la vue des widgets
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
