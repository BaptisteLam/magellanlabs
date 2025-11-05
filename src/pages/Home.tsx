import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AISearchHero from '@/components/sections/AISearchHero';
import SEOHead from '@/components/SEOHead';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/magellan/client';
import { toast } from 'sonner';
import { Database } from 'lucide-react';

const Home = () => {
  const [showFooter, setShowFooter] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const { isDark } = useThemeStore();

  const handleMigration = async () => {
    try {
      setIsMigrating(true);
      toast.info('Migration en cours...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté pour migrer les données');
        return;
      }

      const { data, error } = await supabase.functions.invoke('migrate-to-magellan', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success(`Migration réussie ! ${data.stats.profiles} profils, ${data.stats.projects} projets, ${data.stats.build_sessions} sessions, ${data.stats.websites} sites, ${data.stats.screenshots} captures`);
    } catch (error) {
      console.error('Erreur de migration:', error);
      toast.error('Erreur lors de la migration');
    } finally {
      setIsMigrating(false);
    }
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
      
      <main>
        <div className="container mx-auto px-4 py-8">
          <Button 
            onClick={handleMigration}
            disabled={isMigrating}
            className="mb-8"
            size="lg"
          >
            <Database className="mr-2 h-5 w-5" />
            {isMigrating ? 'Migration en cours...' : 'Migrer vers Magellan'}
          </Button>
        </div>
        
        <AISearchHero onGeneratedChange={setShowFooter} />
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export default Home;