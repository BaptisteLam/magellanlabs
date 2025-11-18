import { FolderOpen, Settings, User, CreditCard, Plug, LogOut, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

type SettingsSection = 'projects' | 'general' | 'profile' | 'subscription' | 'integrations';

const menuItems: { id: SettingsSection; label: string; icon: typeof FolderOpen }[] = [
  { id: 'projects', label: 'Mes Projets', icon: FolderOpen },
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

  const handleHome = () => {
    navigate('/');
  };

  return (
    <div className="h-full bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl flex flex-col shadow-lg">
      <div className="p-6 flex-shrink-0 border-b border-border/30">
        <h2 className="text-lg font-semibold text-foreground">Paramètres</h2>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-4 space-y-1 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <Button
                key={item.id}
                onClick={() => setSection(item.id)}
                variant={isActive ? "magellan" : "ghost"}
                className={cn(
                  'w-full justify-start gap-3',
                  !isActive && 'text-muted-foreground hover:text-[#03A5C0] border border-transparent hover:border-[#03A5C0]'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-border/30 flex-shrink-0 space-y-2">
        <button
          onClick={handleHome}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Home className="h-5 w-5" />
          <span>Accueil</span>
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
