import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Users, 
  Target, 
  Shield, 
  Zap,
  Award,
  Heart,
  Code,
  MessageSquare,
  Briefcase
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const About = () => {
  const { t } = useTranslation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Magellan",
      "description": "Plateforme IA révolutionnaire pour créer des sites web et applications mobiles instantanément",
      "applicationCategory": "DeveloperApplication"
    }
  };

  const team = [
    {
      name: 'Guillaume', 
      role: t('about.team.guillaume.role'),
      description: t('about.team.guillaume.description'),
      avatar: 'G',
      color: 'bg-gradient-hero'
    },
    {
      name: 'Baptiste',
      role: t('about.team.baptiste.role'),
      description: t('about.team.baptiste.description'),
      avatar: 'B',
      color: 'bg-gradient-hero'
    },
    {
      name: 'Dylane',
      role: t('about.team.dylane.role'),
      description: t('about.team.dylane.description'),
      avatar: 'D',
      color: 'bg-gradient-hero'
    }
  ];

  const values = [
    {
      icon: Zap,
      title: t('about.values.innovation.title'),
      description: t('about.values.innovation.description'),
    },
    {
      icon: Heart,
      title: t('about.values.proximity.title'),
      description: t('about.values.proximity.description'),
    },
    {
      icon: Shield,
      title: t('about.values.reliability.title'),
      description: t('about.values.reliability.description'),
    }
  ];

  const timeline = [
    {
      year: '2021',
      title: t('about.timeline.2021.title'),
      description: t('about.timeline.2021.description')
    },
    {
      year: '2022',
      title: t('about.timeline.2022.title'),
      description: t('about.timeline.2022.description')
    },
    {
      year: '2023',
      title: t('about.timeline.2023.title'),
      description: t('about.timeline.2023.description')
    },
    {
      year: '2024',
      title: t('about.timeline.2024.title'),
      description: t('about.timeline.2024.description')
    }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead 
        title="À Propos de Magellan | Plateforme IA de Création Web"
        description="Découvrez Magellan : la plateforme d'intelligence artificielle qui permet de créer des sites web et applications mobiles professionnels en quelques secondes."
        keywords="Magellan, IA création web, intelligence artificielle, générateur site, plateforme développement, création automatique"
        canonicalUrl="https://magellan-studio.fr/about"
        structuredData={structuredData}
      />
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="pt-20 pb-12 lg:pt-28 lg:pb-20 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto fade-in">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-trinity-blue mb-4">
                {t('about.title')}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                {t('about.subtitle')}
              </p>
              <p className="text-base text-muted-foreground max-w-3xl mx-auto">
                {t('about.description')}
              </p>
            </div>
          </div>
        </section>

        {/* Notre équipe */}
        <section className="py-12 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                {t('about.team.title')}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('about.team.subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {team.map((member, index) => (
                <div 
                  key={member.name}
                  className="text-center fade-in bg-white rounded-2xl p-6 shadow-trinity hover-lift"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`w-16 h-16 ${member.color} rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4`}>
                    {member.avatar}
                  </div>
                  <h3 className="text-xl font-semibold text-trinity-blue mb-1">
                    {member.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium mb-3">
                    {member.role}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nos valeurs */}
        <section className="py-12 lg:py-20 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                {t('about.values.title')}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('about.values.subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div 
                    key={value.title}
                    className="text-center fade-in bg-white rounded-2xl p-6 shadow-trinity"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  >
                    <div className="w-12 h-12 bg-gradient-hero rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-trinity-blue mb-2">
                      {value.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Notre histoire */}
        <section className="py-12 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                {t('about.history.title')}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('about.history.subtitle')}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              {timeline.map((event, index) => (
                <div 
                  key={event.year}
                  className="flex items-start mb-8 fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex flex-col items-center mr-6">
                    <div className="w-10 h-10 bg-gradient-hero rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {event.year.slice(-2)}
                    </div>
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-12 bg-trinity-blue-muted mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-semibold text-trinity-blue mr-3">
                        {event.title}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {event.year}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 lg:py-20 bg-trinity-blue text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="fade-in">
                <div className="text-2xl md:text-3xl font-bold mb-2">50+</div>
                <div className="text-sm text-white/80">{t('about.stats.projects')}</div>
              </div>
              <div className="fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="text-2xl md:text-3xl font-bold mb-2">96%</div>
                <div className="text-sm text-white/80">{t('about.stats.satisfaction')}</div>
              </div>
              <div className="fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="text-2xl md:text-3xl font-bold mb-2">{t('about.stats.experience.years')}</div>
                <div className="text-sm text-white/80">{t('about.stats.experience')}</div>
              </div>
              <div className="fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="text-2xl md:text-3xl font-bold mb-2">24h</div>
                <div className="text-sm text-white/80">{t('about.stats.response')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 lg:py-20 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-3xl mx-auto fade-in">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                {t('about.cta.title')}
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                {t('about.cta.subtitle')}
              </p>
              <Button 
                asChild 
                size="lg"
                className="btn-trinity-hero group"
              >
                <Link to="/contact">
                  {t('about.cta.button')}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default About;