import { useSettingsStore } from '@/stores/settingsStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          'max-w-[70vw] h-[70vh] p-0 gap-0',
          'bg-background border border-border/50 rounded-xl overflow-hidden'
        )}
      >
        <div className="flex h-full">
          <SettingsSidebar />

          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-end p-4 border-b border-border/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSettings}
                className="h-8 w-8 rounded-full hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">{renderSection()}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
