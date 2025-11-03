import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AISearchHero from '@/components/sections/AISearchHero';
import SEOHead from '@/components/SEOHead';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';

const Home = () => {
  const [showFooter, setShowFooter] = useState(true);
  const [showHeader, setShowHeader] = useState(true);
  const { isDark } = useThemeStore();
  
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
      {showHeader && <Header />}
      
      <main>
        <AISearchHero 
          onGeneratedChange={(hasGenerated) => {
            setShowFooter(!hasGenerated);
            setShowHeader(!hasGenerated);
          }} 
        />
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export default Home;