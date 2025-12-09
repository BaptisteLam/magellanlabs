import { SiteWeb } from './sections/SiteWeb';
import { Analytiques } from './sections/Analytiques';
import { Contact } from './sections/Contact';
import { Blog } from './sections/Blog';
import { Facture } from './sections/Facture';
import { Finance } from './sections/Finance';
import { Marketing } from './sections/Marketing';
import { Parametres } from './sections/Parametres';

export type SettingsSection = 'siteweb' | 'analytiques' | 'contact' | 'blog' | 'facture' | 'finance' | 'marketing' | 'parametres';

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
      case 'blog':
        return <Blog />;
      case 'facture':
        return <Facture />;
      case 'finance':
        return <Finance />;
      case 'marketing':
        return <Marketing />;
      case 'parametres':
        return <Parametres />;
      default:
        return <SiteWeb />;
    }
  };

  return <div className="p-6">{renderSection()}</div>;
}
