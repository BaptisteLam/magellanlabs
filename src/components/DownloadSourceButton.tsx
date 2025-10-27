import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

export const DownloadSourceButton = () => {
  const handleDownload = async () => {
    try {
      const zip = new JSZip();

      // Fichiers de configuration
      const configFiles = [
        'vite.config.ts',
        'tailwind.config.ts',
        'tsconfig.json',
        'tsconfig.app.json',
        'tsconfig.node.json',
        'postcss.config.js',
        'components.json',
        'eslint.config.js',
        'index.html',
        '.env',
        'package.json'
      ];

      // Répertoires source
      const sourceDirectories = [
        'src/components',
        'src/pages',
        'src/hooks',
        'src/lib',
        'src/stores',
        'src/integrations',
        'src/assets',
        'public'
      ];

      // Fichiers source principaux
      const mainFiles = [
        'src/App.tsx',
        'src/App.css',
        'src/main.tsx',
        'src/index.css',
        'src/vite-env.d.ts'
      ];

      // Ajouter README
      const readme = `# Trinity Studio AI - Code Source

## Installation

1. Installez les dépendances :
\`\`\`bash
npm install
\`\`\`

2. Lancez le serveur de développement :
\`\`\`bash
npm run dev
\`\`\`

3. Pour compiler en production :
\`\`\`bash
npm run build
\`\`\`

## Technologies

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- React Router

## Structure du projet

- \`src/components\` - Composants réutilisables
- \`src/pages\` - Pages de l'application
- \`src/hooks\` - Hooks personnalisés
- \`src/lib\` - Utilitaires
- \`src/stores\` - Stores Zustand
- \`src/integrations\` - Intégrations (Supabase)

## Configuration

Configurez vos variables d'environnement dans le fichier \`.env\`.

---

© ${new Date().getFullYear()} Trinity Studio AI
`;

      zip.file('README.md', readme);

      // Fonction pour récupérer le contenu via fetch
      const fetchFile = async (path: string) => {
        try {
          const response = await fetch(`/${path}`);
          if (!response.ok) throw new Error(`Erreur ${response.status}`);
          return await response.text();
        } catch (error) {
          console.warn(`Impossible de charger ${path}:`, error);
          return null;
        }
      };

      // Charger les fichiers de configuration
      for (const file of configFiles) {
        const content = await fetchFile(file);
        if (content) zip.file(file, content);
      }

      // Charger les fichiers source principaux
      for (const file of mainFiles) {
        const content = await fetchFile(file);
        if (content) zip.file(file, content);
      }

      // Charger les répertoires (approximation - dans un vrai projet, il faudrait lister les fichiers)
      // Pour simplifier, on ajoute les fichiers principaux connus
      const knownFiles = [
        'src/components/layout/Header.tsx',
        'src/components/layout/Footer.tsx',
        'src/components/sections/HeroSection.tsx',
        'src/components/sections/LandingHero.tsx',
        'src/components/sections/AISearchHero.tsx',
        'src/components/sections/ServicesSection.tsx',
        'src/components/sections/TestimonialsSection.tsx',
        'src/components/SEOHead.tsx',
        'src/components/ScrollToTop.tsx',
        'src/components/FileTree.tsx',
        'src/components/VitePreview.tsx',
        'src/components/ui/TextType.tsx',
        'src/components/ui/button.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/textarea.tsx',
        'src/components/ui/card.tsx',
        'src/pages/Home.tsx',
        'src/pages/About.tsx',
        'src/pages/Contact.tsx',
        'src/pages/Pricing.tsx',
        'src/pages/Dashboard.tsx',
        'src/pages/Auth.tsx',
        'src/pages/AIBuilder.tsx',
        'src/pages/BuilderSession.tsx',
        'src/pages/NotFound.tsx',
        'src/pages/PrivacyPolicy.tsx',
        'src/pages/TermsOfService.tsx',
        'src/hooks/useTranslation.ts',
        'src/hooks/use-mobile.tsx',
        'src/hooks/use-toast.ts',
        'src/lib/utils.ts',
        'src/stores/themeStore.ts',
        'src/integrations/supabase/client.ts'
      ];

      for (const file of knownFiles) {
        const content = await fetchFile(file);
        if (content) zip.file(file, content);
      }

      // Générer le ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Télécharger
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trinity-studio-ai-source-${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Code source téléchargé !");
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      toast.error("Erreur lors du téléchargement du code source");
    }
  };

  return (
    <Button
      onClick={handleDownload}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Download className="w-4 h-4" />
      Télécharger le code source
    </Button>
  );
};
