import { SiteWeb } from './sections/SiteWeb';
import { Analytiques } from './sections/Analytiques';
import { Contact } from './sections/Contact';
import { Parametres } from './sections/Parametres';

export type SettingsSection = 'siteweb' | 'analytiques' | 'contact' | 'parametres';

interface SettingsCenterProps {
  section: SettingsSection;
}

export function SettingsCenter({ section }: SettingsCenterProps) {
  const renderSection = () => {
    switch (section) {
      case 'siteweb':
        return <SiteWeb />;
      case 'analytiques':
        return <Analytiques />;
      case 'contact':
        return <Contact />;
      case 'parametres':
        return <Parametres />;
      default:
        return <SiteWeb />;
    }
  };

  return <div className="p-6">{renderSection()}</div>;
}