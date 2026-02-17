import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Monitor, 
  Calendar, 
  ShoppingBag, 
  Settings,
  ArrowRight,
  Zap,
  Shield,
  Users
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const ServicesSection = () => {
  const { t } = useTranslation();
  
  const services = [
    {
      icon: Monitor,
      title: t('services.vitrine.title'),
      description: t('services.vitrine.description'),
      features: ['Design sur-mesure', 'SEO optimisé', 'Mobile-first'],
    },
    {
      icon: Calendar,
      title: t('services.reservation.title'),
      description: t('services.reservation.description'),
      features: ['Planning en temps réel', 'Notifications SMS/Email', 'Gestion des créneaux'],
    },
    {
      icon: ShoppingBag,
      title: t('services.ecommerce.title'),
      description: t('services.ecommerce.description'),
      features: ['Paiement sécurisé', 'Gestion des stocks', 'Analytics avancées'],
    },
    {
      icon: Settings,
      title: t('services.crm.title'),
      description: t('services.crm.description'),
      features: ['Gestion clients', 'Automatisation', 'Reporting'],
    },
  ];

  const advantages = [
    {
      icon: Zap,
      title: 'Innovation continue',
      description: 'Nous utilisons les dernières technologies pour créer des solutions modernes et performantes.',
    },
    {
      icon: Users,
      title: 'Accompagnement personnalisé',
      description: 'Un suivi sur-mesure de A à Z, de la conception à la mise en ligne et au-delà.',
    },
    {
      icon: Shield,
      title: 'Fiabilité & réactivité',
      description: 'Des solutions robustes avec un support réactif pour assurer la continuité de votre activité.',
    },
  ];

  return (
    <section className="py-12 lg:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-trinity-blue mb-4">
            {t('services.title')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('services.subtitle')}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div 
                key={service.title}
                className="trinity-card-service group fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-trinity-blue to-cyan-500 rounded-xl mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold text-trinity-blue mb-2">
                  {service.title}
                </h3>
                
                <p className="text-sm text-muted-foreground mb-3">
                  {service.description}
                </p>

                <ul className="space-y-1 text-xs">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-trinity-blue rounded-full mr-2"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Pourquoi nous choisir */}
        <div className="bg-trinity-blue-soft rounded-3xl p-6 lg:p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
              Pourquoi choisir Magellan ?
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Notre expertise et notre approche humaine font la différence dans chacun de nos projets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {advantages.map((advantage, index) => {
              const Icon = advantage.icon;
              return (
                <div 
                  key={advantage.title}
                  className="text-center fade-in"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-white rounded-2xl shadow-md mb-4 mx-auto hover-lift">
                    <Icon className="w-6 h-6 text-trinity-blue" />
                  </div>
                  <h4 className="text-base font-semibold text-trinity-blue mb-2">
                    {advantage.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {advantage.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Button 
            asChild 
            size="lg"
            className="btn-trinity-hero group"
          >
            <Link to="/portfolio">
              Voir nos réalisations
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;