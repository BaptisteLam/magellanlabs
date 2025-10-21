import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { 
  ExternalLink, 
  Calendar, 
  Monitor, 
  ShoppingBag, 
  Settings,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const Portfolio = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const { t } = useTranslation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": "Portfolio Trinity Studio",
    "description": "Découvrez nos réalisations : sites vitrine, e-commerce et systèmes de réservation pour artisans, restaurants et TPE/PME",
    "creator": {
      "@type": "Organization",
      "name": "Trinity Studio"
    },
    "genre": "Web Development Portfolio",
    "workExample": [
      {
        "@type": "WebSite",
        "name": "Buerehoft Restaurant",
        "description": "Site vitrine élégant pour restaurant avec menu interactif"
      },
      {
        "@type": "WebSite", 
        "name": "CM Renov Artisan",
        "description": "Site professionnel pour artisan avec galerie de réalisations"
      }
    ]
  };

  const categories = [
    { id: 'all', name: t('portfolio.filter.all'), icon: null },
    { id: 'vitrine', name: t('portfolio.filter.vitrine'), icon: Monitor },
    { id: 'reservation', name: t('portfolio.filter.reservation'), icon: Calendar },
    { id: 'ecommerce', name: t('portfolio.filter.ecommerce'), icon: ShoppingBag },
    { id: 'crm', name: t('portfolio.filter.crm'), icon: Settings },
  ];

  const projects = [
    {
      id: 1,
      title: 'Restaurant Le Buerehoft',
      category: 'reservation',
      type: t('portfolio.project.buerehoft.type'),
      description: t('portfolio.project.buerehoft.description'),
      image: '/lovable-uploads/b487a657-0552-4b37-97fa-5a1ead071037.png',
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
      features: [t('portfolio.project.buerehoft.feature1'), t('portfolio.project.buerehoft.feature2'), t('portfolio.project.buerehoft.feature3')],
      link: '#',
      year: '2024'
    },
    {
      id: 2,
      title: 'CM RENOV\'',
      category: 'vitrine',
      type: t('portfolio.project.cmrenov.type'),
      description: t('portfolio.project.cmrenov.description'),
      image: '/lovable-uploads/0be633c5-8575-4bbe-b2cb-d253687c885f.png',
      technologies: ['React', 'Tailwind CSS', 'Netlify'],
      features: [t('portfolio.project.cmrenov.feature1'), t('portfolio.project.cmrenov.feature2'), t('portfolio.project.cmrenov.feature3')],
      link: '#',
      year: '2024'
    },
    {
      id: 3,
      title: 'Boutique Drag\'eau',
      category: 'ecommerce',
      type: t('portfolio.project.drageau.type'),
      description: t('portfolio.project.drageau.description'),
      image: '/lovable-uploads/0f5743a2-5d18-470c-b453-dafc0252ce77.png',
      technologies: ['React', 'Stripe', 'i18n', 'Analytics'],
      features: [t('portfolio.project.drageau.feature1'), t('portfolio.project.drageau.feature2'), t('portfolio.project.drageau.feature3')],
      link: '#',
      year: '2023'
    },
    {
      id: 4,
      title: 'Natural Paysage',
      category: 'crm',
      type: t('portfolio.project.naturalpaysage.type'),
      description: t('portfolio.project.naturalpaysage.description'),
      image: '/lovable-uploads/599ac435-3aa2-45ba-9fd2-848553647d44.png',
      technologies: ['React', 'Node.js', 'MongoDB', 'PDF Generation'],
      features: [t('portfolio.project.naturalpaysage.feature1'), t('portfolio.project.naturalpaysage.feature2'), t('portfolio.project.naturalpaysage.feature3')],
      link: '#',
      year: '2023'
    },
    {
      id: 5,
      title: 'Only Queen Agency',
      category: 'vitrine',
      type: t('portfolio.project.onlyqueen.type'),
      description: t('portfolio.project.onlyqueen.description'),
      image: '/lovable-uploads/ada603a7-fed6-45cb-98c1-38bfae181de2.png',
      technologies: ['React', 'Framer Motion', 'Contentful'],
      features: [t('portfolio.project.onlyqueen.feature1'), t('portfolio.project.onlyqueen.feature2'), t('portfolio.project.onlyqueen.feature3')],
      link: '#',
      year: '2024'
    },
    {
      id: 6,
      title: 'Wellness Spa',
      category: 'reservation',
      type: t('portfolio.project.wellness.type'),
      description: t('portfolio.project.wellness.description'),
      image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZjFmNWY5Ii8+CjxwYXRoIGQ9Ik04NSA0MEwxMTUgNDBMMTAwIDcwWiIgZmlsbD0iIzk0YTNiOCIvPgo8L3N2Zz4=',
      technologies: ['React', 'Calendar API', 'Payment Gateway'],
      features: [t('portfolio.project.wellness.feature1'), t('portfolio.project.wellness.feature2'), t('portfolio.project.wellness.feature3')],
      link: '#',
      year: '2024'
    }
  ];

  const filteredProjects = activeFilter === 'all' 
    ? projects 
    : projects.filter(project => project.category === activeFilter);

  const stats = [
    { number: '50+', label: t('portfolio.stats.projects') },
    { number: '98%', label: t('portfolio.stats.satisfaction') },
    { number: t('portfolio.stats.experience.years'), label: t('portfolio.stats.experience') },
    { number: '24h', label: t('portfolio.stats.response') }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead 
        title="Portfolio & Réalisations | Sites Web pour Artisans & Restaurants"
        description="Découvrez nos réalisations : sites vitrine élégants, boutiques e-commerce et systèmes de réservation pour artisans, restaurants et TPE. Projets sur-mesure."
        keywords="portfolio web, réalisations, site vitrine artisan, site restaurant, e-commerce, réservation en ligne, références clients"
        canonicalUrl="https://trinity-studio.fr/portfolio"
        structuredData={structuredData}
      />
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="pt-20 pb-12 lg:pt-28 lg:pb-16 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto fade-in">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-trinity-blue mb-4">
                {t('portfolio.title')}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                {t('portfolio.subtitle')}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
              {stats.map((stat, index) => (
                <div 
                  key={stat.label}
                  className="text-center fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="text-2xl md:text-3xl font-bold text-trinity-blue mb-2">
                    {stat.number}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Filtres */}
        <section className="py-8 bg-white sticky top-16 z-40 border-b border-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveFilter(category.id)}
                    className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeFilter === category.id
                        ? 'bg-trinity-blue text-white shadow-lg'
                        : 'bg-trinity-blue-soft text-trinity-blue hover:bg-trinity-blue hover:text-white'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4 mr-2" />}
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Portfolio Grid */}
        <section className="py-12 lg:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, index) => (
                <div 
                  key={project.id}
                  className="group trinity-card fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Image */}
                  <div className="relative overflow-hidden rounded-xl mb-6">
                    <img 
                      src={project.image} 
                      alt={project.title}
                      className="w-full h-48 object-cover"
                    />
                    
                     {/* Overlay */}
                     <div className="absolute inset-0 bg-trinity-blue/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                       <div className="text-center text-white">
                         <ExternalLink className="w-8 h-8 mx-auto mb-2" />
                         <p className="text-sm font-medium">{t('portfolio.project.view')}</p>
                       </div>
                     </div>
                  </div>

                  {/* Content */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-trinity-blue-light font-medium">
                        {project.type}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {project.year}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-trinity-blue mb-3 group-hover:text-trinity-blue-light transition-colors">
                      {project.title}
                    </h3>

                    <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                      {project.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.features.slice(0, 3).map((feature, idx) => (
                        <span 
                          key={idx}
                          className="text-xs bg-trinity-blue-soft text-trinity-blue px-2 py-1 rounded-md"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                     {/* Technologies */}
                     <div className="text-xs text-muted-foreground mb-4">
                       <strong>{t('portfolio.project.technologies')}:</strong> {project.technologies.join(', ')}
                     </div>
                  </div>
                </div>
              ))}
            </div>

             {filteredProjects.length === 0 && (
               <div className="text-center py-16">
                 <p className="text-muted-foreground text-lg">
                   {t('portfolio.no.projects')}
                 </p>
               </div>
             )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 lg:py-16 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
             <div className="max-w-3xl mx-auto fade-in">
               <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                 {t('portfolio.cta.title')}
               </h2>
               <p className="text-lg text-muted-foreground mb-6">
                 {t('portfolio.cta.subtitle')}
               </p>
               <Button 
                 asChild 
                 size="lg"
                 className="btn-trinity-hero group"
               >
                 <Link to="/contact">
                   {t('portfolio.cta.button')}
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

export default Portfolio;