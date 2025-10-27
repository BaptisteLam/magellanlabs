import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JSZip from 'jszip';
import { toast } from 'sonner';

export const DownloadSourceButton = () => {
  const handleDownloadSource = async () => {
    try {
      toast.info("Préparation du téléchargement...");
      
      const zip = new JSZip();
      
      // Liste des fichiers sources à inclure
      const sourceFiles = [
        // Config files
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'tailwind.config.ts',
        'index.html',
        'README.md',
        
        // Source code
        'src/main.tsx',
        'src/App.tsx',
        'src/App.css',
        'src/index.css',
        
        // Pages
        'src/pages/Home.tsx',
        'src/pages/About.tsx',
        'src/pages/Contact.tsx',
        'src/pages/Pricing.tsx',
        'src/pages/Dashboard.tsx',
        'src/pages/AIBuilder.tsx',
        'src/pages/BuilderSession.tsx',
        'src/pages/Auth.tsx',
        'src/pages/NotFound.tsx',
        'src/pages/PrivacyPolicy.tsx',
        'src/pages/TermsOfService.tsx',
        
        // Components
        'src/components/layout/Header.tsx',
        'src/components/layout/Footer.tsx',
        'src/components/sections/HeroSection.tsx',
        'src/components/sections/LandingHero.tsx',
        'src/components/sections/AISearchHero.tsx',
        'src/components/sections/ServicesSection.tsx',
        'src/components/sections/TestimonialsSection.tsx',
        'src/components/FileTree.tsx',
        'src/components/VitePreview.tsx',
        'src/components/SEOHead.tsx',
        'src/components/ScrollToTop.tsx',
        
        // UI Components
        'src/components/ui/button.tsx',
        'src/components/ui/card.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/textarea.tsx',
        'src/components/ui/dialog.tsx',
        'src/components/ui/toast.tsx',
        'src/components/ui/toaster.tsx',
        'src/components/ui/use-toast.ts',
        'src/components/ui/TextType.tsx',
        'src/components/ui/TextType.css',
        
        // Stores
        'src/stores/themeStore.ts',
        
        // Hooks
        'src/hooks/use-toast.ts',
        'src/hooks/use-mobile.tsx',
        'src/hooks/useTranslation.ts',
        
        // Utils
        'src/lib/utils.ts',
        
        // Supabase
        'src/integrations/supabase/client.ts',
        'supabase/config.toml',
      ];
      
      // Fonction pour récupérer le contenu d'un fichier
      const fetchFile = async (path: string) => {
        try {
          const response = await fetch(`/${path}`);
          if (response.ok) {
            return await response.text();
          }
        } catch (error) {
          console.warn(`Impossible de récupérer ${path}`);
        }
        return null;
      };
      
      // Ajouter tous les fichiers au ZIP
      for (const file of sourceFiles) {
        const content = await fetchFile(file);
        if (content) {
          zip.file(file, content);
        }
      }
      
      // Ajouter un README spécifique
      const readmeContent = `# Trinity Studio AI - Code Source

## Installation

\`\`\`bash
npm install
npm run dev
\`\`\`

## Configuration

1. Créer un fichier \`.env\` à la racine
2. Ajouter vos clés Supabase :
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

## Technologies

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Sandpack (preview)

## Développé par Trinity Studio
`;
      
      zip.file('README_INSTALLATION.md', readmeContent);
      
      // Générer le ZIP
      const blob = await zip.generateAsync({ type: "blob" });
      
      // Télécharger
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trinity-studio-source-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Code source téléchargé !");
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      toast.error("Erreur lors du téléchargement du code source");
    }
  };

  return (
    <Button
      onClick={handleDownloadSource}
      variant="outline"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Télécharger le code source Trinity
    </Button>
  );
};
