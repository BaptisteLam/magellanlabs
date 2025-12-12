import { useState, useEffect } from 'react';
import { Globe, BarChart3, Mail, FileText, Receipt, Wallet, Megaphone, Settings, ChevronDown, FileCode, Smartphone, Plus, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SettingsSection = 'siteweb' | 'analytiques' | 'contact' | 'blog' | 'facture' | 'finance' | 'marketing' | 'parametres';

interface Project {
  id: string;
  title: string | null;
  project_type: string | null;
}

const menuItems: {
  id: SettingsSection;
  label: string;
  icon: typeof Globe;
}[] = [{
  id: 'siteweb',
  label: 'Site Web',
  icon: Globe
}, {
  id: 'analytiques',
  label: 'Analytiques',
  icon: BarChart3
}, {
  id: 'contact',
  label: 'Contact',
  icon: Mail
}, {
  id: 'blog',
  label: 'Blog',
  icon: FileText
}, {
  id: 'facture',
  label: 'Facture',
  icon: Receipt
}, {
  id: 'finance',
  label: 'Finance',
  icon: Wallet
}, {
  id: 'marketing',
  label: 'Marketing',
  icon: Megaphone
}];

interface SettingsSidebarProps {
  currentSection: SettingsSection;
  setSection: (section: SettingsSection) => void;
  selectedProjectId?: string | null;
  onProjectSelect?: (projectId: string) => void;
}

export function SettingsSidebar({
  currentSection,
  setSection,
  selectedProjectId,
  onProjectSelect
}: SettingsSidebarProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Fetch current project name
  useEffect(() => {
    if (selectedProjectId) {
      fetchCurrentProject();
    }
  }, [selectedProjectId]);

  const fetchCurrentProject = async () => {
    if (!selectedProjectId) return;
    
    try {
      const { data, error } = await supabase
        .from('build_sessions')
        .select('id, title, project_type')
        .eq('id', selectedProjectId)
        .single();
      
      if (error) throw error;
      setCurrentProject(data);
    } catch (error) {
      console.error('Error fetching current project:', error);
    }
  };

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
    if (onProjectSelect) {
      onProjectSelect(projectId);
    }
  };

  const handleNewProject = () => {
    navigate('/');
  };

  const ProjectIcon = currentProject ? getProjectIcon(currentProject.project_type) : Globe;

  return (
    <div className="h-full bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl flex flex-col shadow-lg">
      {/* Logo */}
      <div className="flex-shrink-0 border-b border-border/30 flex items-center justify-start px-[24px] py-px cursor-pointer" onClick={() => navigate('/')}>
        <img src="/lovable-uploads/magellan-logo-light.png" alt="Magellan" className="h-16 dark:hidden" />
        <img src="/lovable-uploads/magellan-logo-dark.png" alt="Magellan" className="h-16 hidden dark:block" />
      </div>

      {/* Project Name Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <ProjectIcon className="h-5 w-5 text-[#03A5C0]" />
          <span className="font-medium text-foreground truncate">
            {currentProject?.title || 'Sélectionner un projet'}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-4 space-y-1 py-4">
          {/* Menu items standard */}
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "text-[#03A5C0]" : "text-foreground/80 hover:text-[#03A5C0]",
                  "focus:outline-none"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Paramètres en bas avec dropdown Projets */}
      <div className="p-4 border-t border-border/30 flex-shrink-0 space-y-1">
        {/* Projets dropdown in settings */}
        <DropdownMenu onOpenChange={(open) => open && fetchProjects()}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "text-foreground/80 hover:text-[#03A5C0]",
                "focus:outline-none"
              )}
            >
              <span className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5" />
                <span>Projets</span>
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side="top" 
            align="start" 
            className="w-56 bg-popover border border-border shadow-lg z-50"
          >
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-2 px-3">Chargement...</div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2 px-3">Aucun projet</div>
            ) : (
              projects.map(project => {
                const ProjIcon = getProjectIcon(project.project_type);
                const isSelected = selectedProjectId === project.id;
                return (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      isSelected && "text-[#03A5C0] font-medium"
                    )}
                  >
                    <ProjIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{project.title || 'Sans titre'}</span>
                  </DropdownMenuItem>
                );
              })
            )}
            <DropdownMenuItem
              onClick={handleNewProject}
              className="flex items-center gap-2 cursor-pointer text-[#03A5C0] border-t border-border/30 mt-1 pt-2"
            >
              <Plus className="h-4 w-4 flex-shrink-0" />
              <span>Nouveau projet</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings button */}
        <button
          onClick={() => setSection('parametres')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            currentSection === 'parametres' ? "text-[#03A5C0]" : "text-foreground/80 hover:text-[#03A5C0]",
            "focus:outline-none"
          )}
        >
          <Settings className="h-5 w-5" />
          <span>Paramètres</span>
        </button>
      </div>
    </div>
  );
}

export type { SettingsSection };
