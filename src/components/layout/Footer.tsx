import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Twitter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';

const Footer = () => {
  const { isDark } = useThemeStore();
  const navigation = [
    { name: 'Entreprise', href: '/about' },
    { name: 'Tarif', href: '/tarifs' },
    { name: 'Support', href: '/contact' },
  ];

  const socialLinks = [
    { name: 'Facebook', href: '#', icon: Facebook },
    { name: 'Instagram', href: '#', icon: Instagram },
    { name: 'LinkedIn', href: '#', icon: Linkedin },
    { name: 'Twitter', href: '#', icon: Twitter },
  ];

  const handleDownloadMagellan = async () => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Créer un fichier HTML de base pour Magellan
      const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Magellan Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <h1 class="text-4xl font-bold text-center mt-10">Magellan Studio</h1>
  <p class="text-center mt-4">Votre site web généré par l'IA</p>
</body>
</html>`;

      zip.file('index.html', htmlContent);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'magellan-site.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Fichiers Magellan téléchargés !');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  return (
    <footer className="relative bg-card/80 backdrop-blur-md overflow-hidden border-t border-border">
      {/* Cyan glows extending from above */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[400px] left-1/4 w-[800px] h-[800px] rounded-full blur-[150px]"
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.2)' }} />
        <div className="absolute -top-[400px] right-1/4 w-[800px] h-[800px] rounded-full blur-[150px]"
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.15)' }} />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo et description */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src={isDark ? "/lovable-uploads/magellan-logo-dark.png" : "/lovable-uploads/magellan-logo-light.png"}
                alt="Magellan - Agence Web"
                className="h-16 w-auto"
              />
            </div>
            <p className="text-foreground/70 max-w-md text-sm">
              Chez Magellan, notre mission est simple : rendre la création de site web aussi rapide qu'une recherche Google.
              Plus besoin de coder, de payer une agence ou d'attendre : l'IA vous génère un site professionnel, en temps réel.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-foreground/70 hover:text-foreground transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <ul className="space-y-2 mb-6">
              <li>
                <a
                  href="mailto:contact@magellan-studio.fr"
                  className="text-foreground/70 hover:text-foreground transition-colors text-sm"
                >
                  contact@magellan-studio.fr
                </a>
              </li>
            </ul>
            <div className="flex space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                    aria-label={social.name}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-foreground/60">
              &copy; {new Date().getFullYear()} Magellan Studio. Tous droits réservés.
            </p>
            <Button
              onClick={handleDownloadMagellan}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Télécharger le site Magellan
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;