import { useSettingsStore } from '@/stores/settingsStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SettingsSidebar } from './SettingsSidebar';
import { MyProjects } from './sections/MyProjects';
import { General } from './sections/General';
import { Profile } from './sections/Profile';
import { Subscription } from './sections/Subscription';
import { Integrations } from './sections/Integrations';
import { cn } from '@/lib/utils';

export function SettingsCenter() {
  const { isOpen, closeSettings, currentSection } = useSettingsStore();

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
    <Dialog open={isOpen} onOpenChange={closeSettings}>
      <DialogContent
        className={cn(
          'max-w-[85vw] h-[85vh] p-0 gap-0',
          'bg-background border border-border/50 rounded-xl overflow-hidden'
        )}
      >
        <div className="flex h-full">
          <SettingsSidebar />

          <div className="flex-1 overflow-y-auto p-8">{renderSection()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
