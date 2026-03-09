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
    "description": "AI platform to create websites and mobile applications in seconds",
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
        title="Magellan: Create your website with AI in one prompt."
        description="Magellan creates your website or mobile app in seconds using AI. Your digital project in one prompt."
        keywords="AI website creation, website generator, AI mobile app, automatic website creation, artificial intelligence, fast web development"
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