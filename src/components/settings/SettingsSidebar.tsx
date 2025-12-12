import { useState, useEffect, useRef } from 'react';
import { Globe, BarChart3, Mail, FileText, Receipt, Wallet, Megaphone, Settings, ChevronDown, FileCode, Smartphone, Plus, FolderOpen, Upload, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
  project_icon: string | null;
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
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        .select('id, title, project_type, project_icon')
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
        .select('id, title, project_type, project_icon')
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

  const handleIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProjectId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2MB');
      return;
    }

    setIsUploadingIcon(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedProjectId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('project-icons')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-icons')
        .getPublicUrl(filePath);

      // Update build_session with icon URL
      const { error: updateError } = await supabase
        .from('build_sessions')
        .update({ project_icon: publicUrl })
        .eq('id', selectedProjectId);

      if (updateError) throw updateError;

      // Update local state
      setCurrentProject(prev => prev ? { ...prev, project_icon: publicUrl } : null);
      toast.success('Icône mise à jour');
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsUploadingIcon(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const DefaultIcon = currentProject ? getProjectIcon(currentProject.project_type) : Building2;

  return (
    <div className="h-full bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl flex flex-col shadow-lg">
      {/* Project Name Header with Icon */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          {/* Clickable Icon for upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleIconUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingIcon || !selectedProjectId}
            className={cn(
              "relative flex-shrink-0 w-10 h-10 rounded-lg border-2 border-dashed border-border/50 hover:border-[#03A5C0] transition-colors flex items-center justify-center overflow-hidden group",
              isUploadingIcon && "opacity-50 cursor-wait"
            )}
            title="Cliquez pour changer l'icône"
          >
            {currentProject?.project_icon ? (
              <>
                <img 
                  src={currentProject.project_icon} 
                  alt="Project icon" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="h-4 w-4 text-white" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center text-muted-foreground group-hover:text-[#03A5C0] transition-colors">
                {isUploadingIcon ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <DefaultIcon className="h-5 w-5" />
                )}
              </div>
            )}
          </button>

          {/* Project Name */}
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-foreground truncate text-sm">
              {currentProject?.title || 'Sélectionner un projet'}
            </h2>
          </div>
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
                    {project.project_icon ? (
                      <img 
                        src={project.project_icon} 
                        alt="" 
                        className="h-4 w-4 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <ProjIcon className="h-4 w-4 flex-shrink-0" />
                    )}
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
