import { SiteWeb } from './sections/SiteWeb';
import { Analytiques } from './sections/Analytiques';
import { Contact } from './sections/Contact';
import { Parametres } from './sections/Parametres';
import { Profil } from './sections/Profil';
import { Facturation } from './sections/Facturation';

export type SettingsSection = 'siteweb' | 'analytiques' | 'contact' | 'parametres' | 'profil' | 'facturation';

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
      case 'profil':
        return <Profil />;
      case 'facturation':
        return <Facturation />;
      default:
        return <SiteWeb />;
    }
  };

  return <div className="p-2 sm:p-6">{renderSection()}</div>;
}