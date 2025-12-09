import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { SettingsCenter, SettingsSection } from "@/components/settings/SettingsCenter";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState<SettingsSection>(
    (searchParams.get('section') as SettingsSection) || 'siteweb'
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
        {/* Sidebar flottante avec bords arrondis */}
        <div className="w-64 flex-shrink-0">
          <SettingsSidebar 
            currentSection={currentSection} 
            setSection={setCurrentSection} 
          />
        </div>

        {/* Contenu principal */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            <SettingsCenter section={currentSection} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
