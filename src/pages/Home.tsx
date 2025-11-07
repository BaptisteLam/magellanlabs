import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AISearchHero from '@/components/sections/AISearchHero';
import SEOHead from '@/components/SEOHead';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import JSZip from 'jszip';

const Home = () => {
  const [showFooter, setShowFooter] = useState(true);
  const { isDark } = useThemeStore();
  
  const handleDownloadDesignFiles = async () => {
    const zip = new JSZip();
    
    // Design system files
    const indexCssResponse = await fetch('/src/index.css');
    const indexCssContent = await indexCssResponse.text();
    zip.file('design-system/index.css', indexCssContent);
    
    const tailwindConfigResponse = await fetch('/tailwind.config.ts');
    const tailwindConfigContent = await tailwindConfigResponse.text();
    zip.file('design-system/tailwind.config.ts', tailwindConfigContent);
    
    // Home page structure
    const homeContent = `
# Direction Artistique - Page d'Accueil Magellan Studio

## Couleurs principales
- Cyan Magellan: #03A5C0 (HSL: 187 97% 38%)
- Noir: #000000
- Gris: #737373

## Features de la page d'accueil

### 1. Background animé
- Grille en arrière-plan (80px x 80px)
- Glows cyan et turquoise animés avec pulse lent
- Background responsive dark/light mode

### 2. Barre de prompt (PromptBar)
- Input pour l'IA avec placeholder dynamique
- Support d'upload de fichiers images
- Bouton submit avec gradient cyan
- Gestion des fichiers attachés

### 3. Badge "Chat avec Magellan"
- Icône Sparkles
- Border et background avec transparence
- Couleur primaire bleue

### 4. Titre principal
- Responsive (text-4xl md:text-5xl)
- Font bold
- Gestion dark mode

### 5. Sous-titre
- Font light (text-lg md:text-xl)
- Couleurs adaptées au mode dark/light

## Animations
- pulse-slow: 8s ease-in-out infinite
- pulse-slower: 12s ease-in-out infinite
- loadProgress: animation de barre de chargement
- scroll-down: effet de grille descendante

## Composants principaux
- AISearchHero: Composant principal avec toute la logique
- PromptBar: Barre d'input pour l'IA
- Header: Navigation principale
- Footer: Pied de page

## Technologies utilisées
- React + TypeScript
- Tailwind CSS avec design tokens HSL
- Supabase pour le backend
- Lucide React pour les icônes
`;
    
    zip.file('README-Design.md', homeContent);
    
    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magellan-design-files.zip';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Magellan Studio",
    "description": "Agence web innovante spécialisée dans la création de sites internet sur-mesure pour artisans, restaurateurs et TPE/PME",
    "url": "https://magellan-studio.fr",
    "logo": "/lovable-uploads/magellan-logo-light.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+33-6-XX-XX-XX-XX",
      "contactType": "Customer Service",
      "availableLanguage": ["French", "English"]
    },
    "sameAs": [
      "https://www.linkedin.com/company/magellan-studio",
      "https://twitter.com/magellan-studio"
    ],
    "offers": {
      "@type": "Offer",
      "category": "Web Development Services",
      "description": "Sites vitrine, e-commerce, réservation en ligne, CRM personnalisés"
    }
  };
  
  return (
    <div className="min-h-screen">
      <SEOHead 
        title="Magellan Studio - Agence Web Innovante | Sites sur-mesure pour TPE & PME"
        description="Magellan Studio crée des sites web innovants et sur-mesure pour artisans, restaurateurs et TPE. Vitrine, e-commerce, réservation et CRM personnalisés. Devis gratuit."
        keywords="agence web, création site internet, site vitrine, e-commerce, artisan, restaurant, TPE, PME, sur-mesure, réservation en ligne, CRM"
        canonicalUrl="https://magellan-studio.fr"
        structuredData={structuredData}
      />
      <Header />
      
      {/* Bouton flottant pour télécharger les fichiers de design */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleDownloadDesignFiles}
          size="lg"
          className="bg-gradient-to-r from-[#03A5C0] to-[#5BE0E5] hover:shadow-lg transition-all duration-300 hover:scale-105"
        >
          <FileText className="w-5 h-5 mr-2" />
          Télécharger D.A.
          <Download className="w-4 h-4 ml-2" />
        </Button>
      </div>
      
      <main>
        <AISearchHero onGeneratedChange={setShowFooter} />
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export default Home;