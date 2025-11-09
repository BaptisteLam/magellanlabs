import { FolderOpen, Settings, User, CreditCard, Plug, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

type SettingsSection = 'projects' | 'general' | 'profile' | 'subscription' | 'integrations';

const menuItems: { id: SettingsSection; label: string; icon: typeof FolderOpen }[] = [
  { id: 'projects', label: 'Mes Projets', icon: FolderOpen },
  { id: 'general', label: 'Général', icon: Settings },
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'subscription', label: 'Abonnement', icon: CreditCard },
  { id: 'integrations', label: 'Intégrations', icon: Plug },
];

export function SettingsSidebar() {
  const { currentSection, setSection, closeSettings } = useSettingsStore();
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
      closeSettings();
      navigate('/');
      toast({
        title: 'Déconnexion réussie',
      });
    }
  };

  return (
    <div className="w-64 bg-sidebar border-r border-border/50 flex flex-col h-full">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Paramètres</h2>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                'text-sm font-medium',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50">
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
