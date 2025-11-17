import { useSettingsStore } from '@/stores/settingsStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SettingsSidebar } from './SettingsSidebar';
import { MyProjects } from './sections/MyProjects';
import { General } from './sections/General';
import { Profile } from './sections/Profile';
import { Subscription } from './sections/Subscription';
import { Integrations } from './sections/Integrations';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SettingsCenter() {
  const { isOpen, closeSettings, currentSection, setSection } = useSettingsStore();

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
          'bg-background border border-border/50 rounded-[8px] overflow-hidden'
        )}
      >
        <div className="flex h-full">
          <SettingsSidebar currentSection={currentSection} setSection={setSection} />

          <ScrollArea className="flex-1">
            <div className="p-8">{renderSection()}</div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
