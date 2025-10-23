import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AISearchHero from '@/components/sections/AISearchHero';
import SEOHead from '@/components/SEOHead';
import { useState } from 'react';

const Home = () => {
  const [showFooter, setShowFooter] = useState(true);
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Trinity Studio",
    "description": "Agence web innovante spécialisée dans la création de sites internet sur-mesure pour artisans, restaurateurs et TPE/PME",
    "url": "https://trinitystudio.fr",
    "logo": "/lovable-uploads/e3c54182-b806-4948-8c03-e14452931ed7.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+33-6-XX-XX-XX-XX",
      "contactType": "Customer Service",
      "availableLanguage": ["French", "English"]
    },
    "sameAs": [
      "https://www.linkedin.com/company/trinitystudio",
      "https://twitter.com/trinitystudio"
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
        title="Trinity Studio - Agence Web Innovante | Sites sur-mesure pour TPE & PME"
        description="Trinity Studio crée des sites web innovants et sur-mesure pour artisans, restaurateurs et TPE. Vitrine, e-commerce, réservation et CRM personnalisés. Devis gratuit."
        keywords="agence web, création site internet, site vitrine, e-commerce, artisan, restaurant, TPE, PME, sur-mesure, réservation en ligne, CRM"
        canonicalUrl="https://trinitystudio.fr"
        structuredData={structuredData}
      />
      <Header />
      
      <main>
        <AISearchHero onGeneratedChange={setShowFooter} />
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export default Home;