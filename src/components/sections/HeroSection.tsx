import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Sparkles, Zap, Star } from 'lucide-react';
const heroMockup = '/assets/a2e4d991-4224-4811-807f-f2c0d7bbdbca.png';
import { useTranslation } from '@/hooks/useTranslation';

const HeroSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="relative overflow-hidden bg-gradient-soft py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Content */}
          <div className="fade-in">            
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-trinity-blue leading-tight mb-4 relative">
              {t('hero.title')}
            </h1>
            
            <p className="text-xl text-muted-foreground mb-6 max-w-lg">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button 
                asChild 
                size="lg"
                className="btn-trinity-hero group cursor-pointer hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                <Link to="/contact" className="inline-flex items-center justify-center">
                  {t('hero.cta.primary')}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              
              <Button 
                asChild
                variant="outline" 
                size="lg"
                className="btn-trinity-outline group cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                <Link to="/portfolio" className="inline-flex items-center justify-center">
                  <Play className="mr-2 h-4 w-4" />
                  {t('hero.cta.secondary')}
                </Link>
              </Button>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="transform hover:scale-105 transition-transform">
                <div className="text-2xl font-bold text-trinity-blue">50+</div>
                <div className="text-sm text-muted-foreground">{t('hero.stats.projects')}</div>
              </div>
              <div className="transform hover:scale-105 transition-transform">
                <div className="text-2xl font-bold text-trinity-blue">96%</div>
                <div className="text-sm text-muted-foreground">{t('hero.stats.satisfaction')}</div>
              </div>
              <div className="transform hover:scale-105 transition-transform">
                <div className="text-2xl font-bold text-trinity-blue">24h</div>
                <div className="text-sm text-muted-foreground">{t('hero.stats.response')}</div>
              </div>
            </div>
          </div>

          {/* Mockups */}
          <div className="relative slide-in-up">
            {/* Desktop mockup */}
            <div className="relative z-10 hover-lift">
              <img
                src={heroMockup}
                alt="Mockup d'un site web professionnel sur ordinateur portable"
                className="w-full rounded-2xl shadow-trinity"
              />
            </div>
            

            {/* Background decorative elements */}
            <div className="absolute -top-6 -left-6 w-20 h-20 bg-trinity-blue-soft rounded-full opacity-50 animate-pulse"></div>
            <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-gradient-hero opacity-20 rounded-full blur-xl animate-pulse delay-500"></div>
          </div>
        </div>
      </div>

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-50 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E5F3FF' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
    </section>
  );
};

export default HeroSection;