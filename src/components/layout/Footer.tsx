import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Twitter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
import { useProjectStore } from '@/stores/projectStore';

const Footer = () => {
  const { isDark } = useThemeStore();
  const { projectFiles, generatedHtml } = useProjectStore();
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

      // Fonction pour récupérer le contenu d'un fichier
      const fetchFile = async (path: string) => {
        try {
          const response = await fetch(`/${path}`);
          if (response.ok) {
            return await response.text();
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération de ${path}:`, error);
        }
        return null;
      };

      toast.info('Préparation du téléchargement...');

      // Structure des fichiers à télécharger
      const files = [
        // Root files
        'components.json',
        'eslint.config.js',
        'index.html',
        'package.json',
        'postcss.config.js',
        'README.md',
        'tailwind.config.ts',
        'tsconfig.app.json',
        'tsconfig.json',
        'tsconfig.node.json',
        'vite.config.ts',
        
        // src/
        'src/App.css',
        'src/App.tsx',
        'src/index.css',
        'src/main.tsx',
        'src/vite-env.d.ts',
        
        // src/components/
        'src/components/CodeEditor/CodeTreeView.tsx',
        'src/components/CodeEditor/MonacoEditor.tsx',
        'src/components/FileTree.tsx',
        'src/components/PromptBar.tsx',
        'src/components/SEOHead.tsx',
        'src/components/ScrollToTop.tsx',
        'src/components/VitePreview.tsx',
        'src/components/layout/Header.tsx',
        'src/components/layout/Footer.tsx',
        'src/components/sections/AISearchHero.tsx',
        'src/components/sections/HeroSection.tsx',
        'src/components/sections/LandingHero.tsx',
        'src/components/sections/ServicesSection.tsx',
        'src/components/sections/TestimonialsSection.tsx',
        
        // src/components/ui/ (tous les fichiers shadcn)
        'src/components/ui/TextType.tsx',
        'src/components/ui/TextType.css',
        'src/components/ui/accordion.tsx',
        'src/components/ui/alert-dialog.tsx',
        'src/components/ui/alert.tsx',
        'src/components/ui/button.tsx',
        'src/components/ui/card.tsx',
        'src/components/ui/dialog.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/label.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/separator.tsx',
        'src/components/ui/sheet.tsx',
        'src/components/ui/tabs.tsx',
        'src/components/ui/textarea.tsx',
        'src/components/ui/toast.tsx',
        'src/components/ui/toaster.tsx',
        'src/components/ui/use-toast.ts',
        'src/components/ui/tooltip.tsx',
        'src/components/ui/resizable.tsx',
        
        // src/hooks/
        'src/hooks/use-mobile.tsx',
        'src/hooks/use-toast.ts',
        'src/hooks/useTranslation.ts',
        
        // src/integrations/supabase/
        'src/integrations/supabase/client.ts',
        
        // src/lib/
        'src/lib/utils.ts',
        
        // src/pages/
        'src/pages/AIBuilder.tsx',
        'src/pages/About.tsx',
        'src/pages/Auth.tsx',
        'src/pages/Contact.tsx',
        'src/pages/Dashboard.tsx',
        'src/pages/Home.tsx',
        'src/pages/NotFound.tsx',
        'src/pages/Pricing.tsx',
        'src/pages/PrivacyPolicy.tsx',
        'src/pages/TermsOfService.tsx',
        'src/pages/BuilderSession.tsx',
        
        // src/stores/
        'src/stores/themeStore.ts',
        'src/stores/projectStore.ts',
      ];

      // Télécharger tous les fichiers
      for (const filePath of files) {
        const content = await fetchFile(filePath);
        if (content) {
          zip.file(filePath, content);
        }
      }

      // Ajouter les edge functions
      const edgeFunctions = [
        'supabase/functions/ai-generate/index.ts',
        'supabase/functions/claude/index.ts',
        'supabase/functions/claude-stream/index.ts',
        'supabase/functions/deploy-to-cloudflare/index.ts',
        'supabase/functions/generate-screenshot/index.ts',
        'supabase/functions/generate-site/index.ts',
        'supabase/functions/html-to-react/index.ts',
        'supabase/functions/modify-site/index.ts',
        'supabase/functions/send-contact-email/index.ts',
      ];

      for (const funcPath of edgeFunctions) {
        const content = await fetchFile(funcPath);
        if (content) {
          zip.file(funcPath, content);
        }
      }

      // Générer et télécharger le ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'magellan-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Projet Magellan téléchargé avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du téléchargement du projet');
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