import { useState, useEffect } from 'react';
import { Settings, User, CreditCard, Plug, LogOut, ChevronDown, ChevronRight, Globe, FileCode, Smartphone, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SettingsSection = 'general' | 'profile' | 'subscription' | 'integrations';

interface Project {
  id: string;
  title: string | null;
  project_type: string | null;
}

const menuItems: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'Général', icon: Settings },
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'subscription', label: 'Abonnement', icon: CreditCard },
  { id: 'integrations', label: 'Intégrations', icon: Plug },
];

interface SettingsSidebarProps {
  currentSection: SettingsSection;
  setSection: (section: SettingsSection) => void;
}

export function SettingsSidebar({ currentSection, setSection }: SettingsSidebarProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isProjectsOpen && projects.length === 0) {
      fetchProjects();
    }
  }, [isProjectsOpen]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('build_sessions')
        .select('id, title, project_type')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de se déconnecter',
      });
    } else {
      navigate('/');
      toast({
        title: 'Déconnexion réussie',
      });
    }
  };

  const getProjectIcon = (projectType: string | null) => {
    switch (projectType) {
      case 'webapp':
        return FileCode;
      case 'mobile':
        return Smartphone;
      default:
        return Globe;
    }
  };

  const handleProjectClick = (projectId: string) => {
    // Naviguer vers le dashboard du projet
    navigate(`/project/${projectId}`);
  };

  const handleNewProject = () => {
    navigate('/builder');
  };

  return (
    <div className="h-full bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl flex flex-col shadow-lg">
      <div className="p-6 flex-shrink-0 border-b border-border/30">
        <h2 className="text-lg font-semibold text-foreground">Paramètres</h2>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-4 space-y-1 py-4">
          {/* Menu Projets déroulant */}
          <div className="mb-2">
            <button
              onClick={() => setIsProjectsOpen(!isProjectsOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "text-foreground/80 hover:text-[#03A5C0]",
                "focus:outline-none"
              )}
            >
              <span className="flex items-center gap-3">
                {isProjectsOpen ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <span>Projets</span>
              </span>
            </button>

            {/* Liste déroulante des projets */}
            {isProjectsOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l border-border/30 pl-3">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground py-2 px-3">Chargement...</div>
                ) : projects.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2 px-3">Aucun projet</div>
                ) : (
                  projects.map((project) => {
                    const ProjectIcon = getProjectIcon(project.project_type);
                    return (
                      <button
                        key={project.id}
                        onClick={() => handleProjectClick(project.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                          "text-foreground/70 hover:text-[#03A5C0]",
                          "focus:outline-none truncate"
                        )}
                      >
                        <ProjectIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{project.title || 'Sans titre'}</span>
                      </button>
                    );
                  })
                )}

                {/* Bouton Nouveau projet */}
                <button
                  onClick={handleNewProject}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mt-2",
                    "text-[#03A5C0] hover:text-[#03A5C0]/80",
                    "focus:outline-none border border-dashed border-[#03A5C0]/50 hover:border-[#03A5C0]"
                  )}
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span>Nouveau projet</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu items standard */}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <Button
                key={item.id}
                onClick={() => setSection(item.id)}
                variant={isActive ? "magellan-active" : "magellan"}
                className="w-full justify-start gap-3"
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-border/30 flex-shrink-0">
        <Button
          onClick={handleLogout}
          variant="magellan-danger"
          className="w-full justify-start gap-3"
        >
          <LogOut className="h-5 w-5" />
          <span>Déconnexion</span>
        </Button>
      </div>
    </div>
  );
}
