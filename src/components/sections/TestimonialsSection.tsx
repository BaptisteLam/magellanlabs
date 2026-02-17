import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { t } = useTranslation();

  const testimonials = [
    {
      name: 'Marie D.',
      company: 'Restaurant Le Jardin',
      content: 'Magellan a transformé notre présence en ligne ! Notre chiffre d\'affaires a augmenté de 40% grâce à notre nouveau site.',
      rating: 5
    },
    {
      name: 'Pierre M.',
      company: 'CM RENOV\'',
      content: 'Un site vitrine qui nous ressemble enfin. 3x plus de contacts et une image professionnelle qui fait la différence !',
      rating: 5
    },
    {
      name: 'Sophie L.',
      company: 'Boutique Natural',
      content: 'Notre e-commerce dépasse toutes nos attentes. +200% de ventes en 6 mois et une interface utilisateur exceptionnelle !',
      rating: 5
    },
    {
      name: 'Thomas B.',
      company: 'Natural Paysage',
      content: 'Une plateforme CRM parfaitement adaptée à nos besoins. Nous avons gagné 5h par semaine en automatisation.',
      rating: 5
    },
    {
      name: 'Claire R.',
      company: 'Drageau Services',
      content: 'Système de réservation révolutionnaire pour notre activité ! Nos clients adorent la simplicité et nous gagnons du temps.',
      rating: 5
    },
    {
      name: 'Jean-Luc P.',
      company: 'Buerehoft Restaurant',
      content: 'Site élégant qui reflète parfaitement notre identité culinaire. Les réservations en ligne ont triplé !',
      rating: 5
    },
    {
      name: 'Émilie K.',
      company: 'Fleurs & Co',
      content: 'Service client exceptionnel et résultat au-delà de nos espérances. Magellan comprend vraiment les artisans.',
      rating: 5
    },
    {
      name: 'Marc L.',
      company: 'Garage Auto Plus',
      content: 'Site moderne et fonctionnel qui nous démarque de la concurrence. +150% de demandes de devis en 3 mois !',
      rating: 5
    },
    {
      name: 'Isabelle M.',
      company: 'Cabinet Dentaire',
      content: 'Interface de prise de rendez-vous intuitive et design professionnel. Nos patients apprécient vraiment !',
      rating: 5
    },
    {
      name: 'David R.',
      company: 'Boulangerie du Village',
      content: 'Commandes en ligne simplifiées et site qui reflète notre savoir-faire. Un vrai plus pour notre clientèle !',
      rating: 5
    }
  ];

  // Auto-slide functionality - faster for better flow
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000);

    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <section className="py-16 lg:py-20 bg-trinity-blue-soft">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 fade-in">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-trinity-blue mb-4">
            {t('testimonials.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Découvrez ce que disent nos clients sur nos solutions digitales.
          </p>
        </div>

        {/* Testimonials Carousel - Horizontal Scrolling Bubbles */}
        <div className="relative overflow-hidden">
          <div 
            className="flex transition-transform duration-500 ease-in-out space-x-6"
            style={{ 
              transform: `translateX(-${currentIndex * (320 + 24)}px)`,
              width: `${testimonials.length * (320 + 24)}px`
            }}
          >
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="flex-shrink-0 w-80 bg-white rounded-2xl p-6 shadow-trinity hover-lift"
              >
                <div className="flex items-center mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                
                <p className="text-foreground mb-4 text-sm leading-relaxed">
                  "{testimonial.content}"
                </p>
                
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-trinity-blue-soft rounded-full flex items-center justify-center mr-3">
                    <span className="text-trinity-blue font-semibold text-sm">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-trinity-blue text-sm">
                      {testimonial.name}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Gradient overlays for smooth edges */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-trinity-blue-soft to-transparent pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-trinity-blue-soft to-transparent pointer-events-none"></div>
        </div>

        {/* Dots Indicator - Hidden */}
        <div className="hidden justify-center mt-8 space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-trinity-blue w-6' 
                  : 'bg-trinity-blue-muted hover:bg-trinity-blue-light'
              }`}
            />
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 text-center">
          <div className="fade-in">
            <div className="text-3xl md:text-4xl font-bold text-trinity-blue mb-2">96%</div>
            <div className="text-muted-foreground text-sm">{t('testimonials.satisfaction')}</div>
          </div>
          <div className="fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="text-3xl md:text-4xl font-bold text-trinity-blue mb-2">24h</div>
            <div className="text-muted-foreground text-sm">{t('hero.stats.response')}</div>
          </div>
          <div className="fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="text-3xl md:text-4xl font-bold text-trinity-blue mb-2">50+</div>
            <div className="text-muted-foreground text-sm">{t('hero.stats.projects')}</div>
          </div>
          <div className="fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="text-3xl md:text-4xl font-bold text-trinity-blue mb-2">3 ans</div>
            <div className="text-muted-foreground text-sm">D'expérience</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;