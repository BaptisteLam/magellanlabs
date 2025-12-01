import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AISearchHero from '@/components/sections/AISearchHero';
import SEOHead from '@/components/SEOHead';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';

const Home = () => {
  const [showFooter, setShowFooter] = useState(true);
  const { isDark } = useThemeStore();
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Magellan",
    "description": "Plateforme IA pour créer des sites web et applications mobiles en quelques secondes",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR"
    }
  };
  
  return (
    <div className="min-h-screen">
      <SEOHead 
        title="Magellan : Crée ton site web avec l'IA en un prompt."
        description="Magellan créer votre site web ou votre app mobile en quelques secondes grâce à l'IA. Votre projet digital en un prompt."
        keywords="création site web IA, générateur site internet, app mobile IA, création site automatique, intelligence artificielle, développement web rapide"
        canonicalUrl="https://magellan-studio.fr"
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