import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/sections/HeroSection';
import ServicesSection from '@/components/sections/ServicesSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const Home = () => {
  const { t } = useTranslation();

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
        <HeroSection />
        <ServicesSection />
        <TestimonialsSection />
        
        {/* CTA Final */}
        <section className="py-12 lg:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-3xl mx-auto fade-in">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-trinity-blue mb-4 px-4">
                {t('cta.final.title')}
              </h2>
              <p className="text-xl sm:text-2xl text-muted-foreground mb-6 px-4">
                {t('cta.final.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
                <Button 
                  asChild 
                  size="lg"
                  className="btn-trinity-hero group w-full sm:w-auto"
                >
                  <Link to="/contact">
                    {t('cta.final.primary')}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button 
                  asChild 
                  variant="outline"
                  size="lg"
                  className="btn-trinity-outline w-full sm:w-auto"
                 >
                   <Link to="/portfolio">
                     {t('cta.final.secondary')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;