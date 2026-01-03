/**
 * ProjectCRM - Page principale du CRM (modèle flexible)
 * Interface bac à sable avec Canvas, ObjectSidebar et ConversationalPrompt
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GridBackground } from '@/components/crm/GridBackground';
import { ObjectSidebar } from '@/components/crm/ObjectSidebar';
import { Canvas } from '@/components/crm/Canvas';
import { ConversationalPrompt } from '@/components/crm/ConversationalPrompt';
import { useEditMode } from '@/hooks/useEditMode';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { toast } from 'sonner';

export default function ProjectCRM() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();

  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit mode state pour le mode édition
  const editModeState = useEditMode();

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
    <GridBackground>
      <div className="min-h-screen w-full flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 h-16 border-b border-white/10 bg-surface/80 backdrop-blur-sm px-6 flex items-center justify-between shadow-sm">
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
              <h1 className="text-lg font-semibold text-white">{projectTitle}</h1>
              <p className="text-xs text-gray-400">CRM Bac à sable</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Édition Toggle */}
            <Button
              variant={editModeState.editMode ? 'default' : 'outline'}
              size="sm"
              onClick={editModeState.toggleEditMode}
              className={editModeState.editMode ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
            >
              {editModeState.editMode ? 'Mode Lecture' : 'Mode Édition'}
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hover:text-[#03A5C0]"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar gauche avec liste des objets */}
          <div className="w-64 border-r border-white/10 bg-surface/30 backdrop-blur-sm overflow-y-auto">
            <ObjectSidebar
              projectId={projectId}
              selectedObjectType={selectedObjectType}
              onSelectObject={setSelectedObjectType}
            />
          </div>

          {/* Canvas principal */}
          <main className="flex-1 overflow-hidden">
            {selectedObjectType ? (
              <Canvas
                projectId={projectId}
                objectType={selectedObjectType}
                editMode={editModeState.editMode}
                onElementSelect={editModeState.selectElement}
                onElementHover={editModeState.hoverElement}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    Bienvenue dans votre CRM Bac à sable
                  </h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Sélectionnez un objet dans la sidebar pour commencer à travailler
                  </p>
                  <p className="text-xs text-gray-500">
                    💡 Utilisez le mode édition pour modifier les éléments par survol
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Conversational Prompt flottant (logo Magellan en bas à droite) */}
        <ConversationalPrompt
          projectId={projectId}
          currentObjectType={selectedObjectType}
          selectedElement={editModeState.selectedElement}
          onCommandExecuted={() => {
            // Rafraîchir la vue après une commande
            console.log('[ProjectCRM] Command executed, refreshing...');
          }}
        />
      </div>
    </GridBackground>
  );
}
