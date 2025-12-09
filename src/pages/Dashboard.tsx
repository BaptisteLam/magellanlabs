import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { General } from "@/components/settings/sections/General";
import { Profile } from "@/components/settings/sections/Profile";
import { Subscription } from "@/components/settings/sections/Subscription";
import { Integrations } from "@/components/settings/sections/Integrations";
import { ScrollArea } from "@/components/ui/scroll-area";

type SettingsSection = 'general' | 'profile' | 'subscription' | 'integrations';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState<SettingsSection>(
    (searchParams.get('section') as SettingsSection) || 'general'
  );

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
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
      case 'general':
        return <General />;
      case 'profile':
        return <Profile />;
      case 'subscription':
        return <Subscription />;
      case 'integrations':
        return <Integrations />;
      default:
        return <General />;
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


      <div className="flex h-screen px-8 py-6 gap-8">
        {/* Sidebar flottante avec bords arrondis - décalée plus à gauche */}
        <div className="w-64 flex-shrink-0">
          <SettingsSidebar 
            currentSection={currentSection} 
            setSection={setCurrentSection} 
          />
        </div>

        {/* Contenu principal - sans encadrement */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {renderSection()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
