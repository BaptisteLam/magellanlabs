import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { SettingsCenter, SettingsSection } from "@/components/settings/SettingsCenter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState<SettingsSection>(
    (searchParams.get('section') as SettingsSection) || 'siteweb'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get('projectId')
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle checkout success/cancel redirect from Stripe
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast.success('Paiement réussi ! Votre abonnement Premium est maintenant actif.');
      // Clean the URL parameter
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('checkout');
      setSearchParams(newParams);
    }
  }, []);

  // Synchroniser l'URL avec l'état
  useEffect(() => {
    const params: Record<string, string> = { section: currentSection };
    if (selectedProjectId) {
      params.projectId = selectedProjectId;
    }
    setSearchParams(params);
  }, [currentSection, selectedProjectId, setSearchParams]);

  const handleSectionChange = (section: SettingsSection) => {
    setCurrentSection(section);
    setSidebarOpen(false);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentSection('siteweb');
    setSidebarOpen(false);
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

      <div className={`flex h-screen ${isMobile ? 'flex-col px-3 py-3' : 'px-8 py-6 gap-8'}`}>
        {/* Mobile: hamburger menu pour ouvrir la sidebar */}
        {isMobile && (
          <div className="flex items-center gap-3 mb-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-border/50">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="h-full pt-8">
                  <SettingsSidebar
                    currentSection={currentSection}
                    setSection={handleSectionChange}
                    selectedProjectId={selectedProjectId}
                    onProjectSelect={handleProjectSelect}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-medium text-foreground">Dashboard</h1>
          </div>
        )}

        {/* Sidebar flottante avec bords arrondis - desktop uniquement */}
        {!isMobile && (
          <div className="w-64 flex-shrink-0">
            <SettingsSidebar
              currentSection={currentSection}
              setSection={handleSectionChange}
              selectedProjectId={selectedProjectId}
              onProjectSelect={handleProjectSelect}
            />
          </div>
        )}

        {/* Contenu principal */}
        <ScrollArea className="flex-1">
          <div className={isMobile ? 'p-1' : 'p-2'}>
            <SettingsCenter section={currentSection} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
