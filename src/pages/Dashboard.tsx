import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { MyProjects } from "@/components/settings/sections/MyProjects";
import { General } from "@/components/settings/sections/General";
import { Profile } from "@/components/settings/sections/Profile";
import { Subscription } from "@/components/settings/sections/Subscription";
import { Integrations } from "@/components/settings/sections/Integrations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type SettingsSection = 'projects' | 'general' | 'profile' | 'subscription' | 'integrations';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState<SettingsSection>(
    (searchParams.get('section') as SettingsSection) || 'projects'
  );

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Mettre à jour l'URL quand la section change
    setSearchParams({ section: currentSection });
  }, [currentSection, setSearchParams]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'projects':
        return <MyProjects />;
      case 'general':
        return <General />;
      case 'profile':
        return <Profile />;
      case 'subscription':
        return <Subscription />;
      case 'integrations':
        return <Integrations />;
      default:
        return <MyProjects />;
    }
  };

  return (
    <div className="min-h-screen w-full relative">
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

      {/* Header flottant */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img 
                src={isDark ? "/lovable-uploads/magellan-logo-dark.png" : "/lovable-uploads/magellan-logo-light.png"}
                alt="Magellan"
                className="h-20 w-auto"
              />
            </Link>

            {/* Title */}
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-foreground" />
              ) : (
                <Moon className="h-5 w-5 text-foreground" />
              )}
            </Button>
          </div>
        </nav>
      </header>

      <div className="flex h-[calc(100vh-5rem)] p-6 gap-6">
        {/* Sidebar flottante avec bords arrondis */}
        <div className="w-64 flex-shrink-0">
          <SettingsSidebar 
            currentSection={currentSection} 
            setSection={setCurrentSection} 
          />
        </div>

        {/* Contenu principal */}
        <ScrollArea className="flex-1 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-8">
          {renderSection()}
        </ScrollArea>
      </div>
    </div>
  );
}
