import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Monitor, 
  Calendar, 
  ShoppingBag, 
  Settings,
  Check,
  ArrowRight,
  Smartphone,
  Search,
  Lock,
  Zap,
  Users,
  BarChart3
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const Services = () => {
  const { t } = useTranslation();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Services de Développement Web Trinity Studio",
    "description": "Services complets de création de sites internet : vitrine, e-commerce, réservation, CRM personnalisés pour artisans et TPE/PME",
    "provider": {
      "@type": "Organization",
      "name": "Trinity Studio"
    },
    "serviceType": "Web Development",
    "areaServed": "France",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Services Web Trinity Studio",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Site Vitrine",
            "description": "Création de sites vitrine professionnels et responsive"
          }
        },
        {
          "@type": "Offer", 
          "itemOffered": {
            "@type": "Service",
            "name": "E-commerce",
            "description": "Développement de boutiques en ligne complètes"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service", 
            "name": "Système de Réservation",
            "description": "Solutions de réservation en ligne sur-mesure"
          }
        }
      ]
    }
  };
  const services = [
    {
      icon: Monitor,
      title: t('services.vitrine.title'),
      description: t('services.vitrine.description'),
      price: `${t('services.price.from')} 1 500€`,
      features: [
        t('services.vitrine.features.responsive'),
        t('services.vitrine.features.seo'),
        t('services.vitrine.features.social'),
        t('services.vitrine.features.contact'),
        t('services.vitrine.features.gallery'),
        t('services.vitrine.features.hosting')
      ],
      technologies: ['React', 'TypeScript', 'Tailwind CSS'],
      duration: `1 ${t('services.duration.week')}`
    },
    {
      icon: Calendar,
      title: t('services.reservation.title'),
      description: t('services.reservation.description'),
      price: `${t('services.price.from')} 2 500€`,
      features: [
        t('services.reservation.features.realtime'),
        t('services.reservation.features.notifications'),
        t('services.reservation.features.slots'),
        t('services.reservation.features.sms'),
        t('services.reservation.features.admin'),
        t('services.reservation.features.sync')
      ],
      technologies: ['React', 'Node.js', 'PostgreSQL'],
      duration: `2 ${t('services.duration.weeks')}`
    },
    {
      icon: ShoppingBag,
      title: t('services.ecommerce.title'),
      description: t('services.ecommerce.description'),
      price: `${t('services.price.from')} 3 500€`,
      features: [
        t('services.ecommerce.features.catalog'),
        t('services.ecommerce.features.payment'),
        t('services.ecommerce.features.stock'),
        t('services.ecommerce.features.analytics'),
        t('services.ecommerce.features.loyalty'),
        t('services.ecommerce.features.mobile')
      ],
      technologies: ['React', 'Stripe', 'Analytics'],
      duration: `3 ${t('services.duration.weeks')}`
    },
    {
      icon: Settings,
      title: t('services.crm.title'),
      description: t('services.crm.description'),
      price: t('services.crm.duration'),
      features: [
        t('services.crm.features.clients'),
        t('services.crm.features.automation'),
        t('services.crm.features.reports'),
        t('services.crm.features.integrations'),
        t('services.crm.features.multiuser'),
        t('services.crm.features.training')
      ],
      technologies: ['React', 'Node.js', 'Custom APIs'],
      duration: `4 ${t('services.duration.weeks')}`
    }
  ];

  const additionalServices = [
    {
      icon: Smartphone,
      title: t('services.additional.mobile'),
      description: t('services.additional.mobile.desc')
    },
    {
      icon: Search,
      title: t('services.additional.seo'),
      description: t('services.additional.seo.desc')
    },
    {
      icon: Lock,
      title: t('services.additional.security'),
      description: t('services.additional.security.desc')
    },
    {
      icon: Zap,
      title: t('services.additional.performance'),
      description: t('services.additional.performance.desc')
    },
    {
      icon: Users,
      title: t('services.additional.training'),
      description: t('services.additional.training.desc')
    },
    {
      icon: BarChart3,
      title: t('services.additional.maintenance'),
      description: t('services.additional.maintenance.desc')
    }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead 
        title="Services Web Professionnels | Sites Vitrine, E-commerce & Réservation"
        description="Découvrez nos services de création web : sites vitrine, e-commerce, réservation en ligne et CRM personnalisés. Solutions complètes pour artisans et TPE/PME."
        keywords="services web, site vitrine, e-commerce, réservation en ligne, CRM, artisan, restaurant, TPE, développement sur-mesure"
        canonicalUrl="https://trinity-studio.fr/services"
        structuredData={structuredData}
      />
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-20 lg:pt-32 lg:pb-32 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto fade-in">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-trinity-blue mb-6">
                {t('services.page.title')}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {t('services.page.subtitle')}
              </p>
            </div>
          </div>
        </section>

        {/* Services détaillés */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-20">
              {services.map((service, index) => {
                const Icon = service.icon;
                const isEven = index % 2 === 0;
                
                return (
                  <div 
                    key={service.title}
                    className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                      !isEven ? 'lg:grid-flow-col-dense' : ''
                    }`}
                  >
                    {/* Content */}
                    <div className={`fade-in ${!isEven ? 'lg:col-start-2' : ''}`}>
                      <div className="flex items-center mb-6">
                        <div className="flex items-center justify-center w-16 h-16 bg-trinity-blue-soft rounded-2xl mr-4">
                          <Icon className="w-8 h-8 text-trinity-blue" />
                        </div>
                        <div>
                          <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue">
                            {service.title}
                          </h2>
                          <p className="text-lg text-trinity-blue-light font-semibold">
                            {service.price}
                          </p>
                        </div>
                      </div>

                      <p className="text-lg text-muted-foreground mb-6">
                        {service.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {service.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center">
                            <Check className="w-5 h-5 text-trinity-blue mr-3 flex-shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 mb-8">
                        <div className="text-sm text-muted-foreground">
                          <strong>{t('services.technologies')}:</strong> {service.technologies.join(', ')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <strong>{t('services.duration')}:</strong> {service.duration}
                        </div>
                      </div>

                      <Button 
                        asChild 
                        className="btn-trinity-hero group"
                      >
                        <Link to="/contact">
                          {t('services.quote.button')}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </div>

                    {/* Visual */}
                    <div className={`fade-in ${!isEven ? 'lg:col-start-1' : ''}`}>
                      <div className="bg-gradient-to-br from-trinity-blue-soft via-blue-50 to-cyan-50 rounded-3xl p-8 lg:p-12 hover-lift">
                        <div className="w-full h-64 bg-gradient-to-br from-white via-white to-blue-50/30 rounded-2xl shadow-md flex items-center justify-center">
                          <Icon className="w-20 h-20 text-trinity-blue" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Services additionnels */}
        <section className="py-20 lg:py-32 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-trinity-blue mb-4">
                {t('services.additional.title')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {t('services.additional.subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {additionalServices.map((service, index) => {
                const Icon = service.icon;
                return (
                  <div 
                    key={service.title}
                    className="bg-white rounded-2xl p-6 hover-lift fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-center w-12 h-12 bg-trinity-blue-soft rounded-xl mb-4">
                      <Icon className="w-6 h-6 text-trinity-blue" />
                    </div>
                    <h3 className="text-lg font-semibold text-trinity-blue mb-2">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-3xl mx-auto fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-trinity-blue mb-6">
                {t('services.cta.title')}
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                {t('services.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  asChild 
                  size="lg"
                  className="btn-trinity-hero group"
                >
                  <Link to="/contact">
                    {t('services.cta.quote')}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button 
                  asChild 
                  variant="outline" 
                  size="lg"
                  className="btn-trinity-outline"
                >
                  <Link to="/portfolio">
                    {t('services.cta.portfolio')}
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

export default Services;