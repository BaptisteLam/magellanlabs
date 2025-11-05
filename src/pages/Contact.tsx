import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mail, 
  Phone, 
  Clock,
  Send,
  CheckCircle,
  MessageCircle,
  Calendar,
  Loader2
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase } from '@/integrations/magellan/client';
import { toast } from 'sonner';

const Contact = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "mainEntity": {
      "@type": "Organization",
      "name": "Magellan Studio",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+33 6 78 01 57 32",
        "contactType": "Customer Service",
        "email": "contact@magellan-studio.fr",
        "availableLanguage": ["French", "English"],
        "hoursAvailable": "Mo-Fr 09:00-18:00"
      },
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "FR",
        "addressLocality": "France"
      }
    },
    "potentialAction": {
      "@type": "ContactAction",
      "target": "https://magellan-studio.fr/contact"
    }
  };
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    projectType: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger le script Calendly
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Nettoyage lors du démontage du composant
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation simple
    if (!formData.name || !formData.email || !formData.projectType) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: formData
      });
      
      if (error) {
        console.error('Erreur Supabase:', error);
        toast.error('Erreur lors de l\'envoi du message. Veuillez réessayer.');
        return;
      }
      
      console.log('Réponse de la fonction:', data);
      
      // Redirect to thank you page
      navigate('/merci');
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error);
      toast.error('Erreur lors de l\'envoi du message. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const projectTypes = [
    { value: 'vitrine', label: t('contact.form.projectTypes.vitrine') },
    { value: 'ecommerce', label: t('contact.form.projectTypes.ecommerce') },
    { value: 'reservation', label: t('contact.form.projectTypes.reservation') },
    { value: 'crm', label: t('contact.form.projectTypes.crm') },
    { value: 'other', label: t('contact.form.projectTypes.other') }
  ];

  const budgetRanges = [
    { value: '1000-2500', label: t('contact.form.budgetRanges.1000-2500') },
    { value: '2500-5000', label: t('contact.form.budgetRanges.2500-5000') },
    { value: '5000-10000', label: t('contact.form.budgetRanges.5000-10000') },
    { value: '10000+', label: t('contact.form.budgetRanges.10000+') },
    { value: 'discuss', label: t('contact.form.budgetRanges.discuss') }
  ];

  const timelines = [
    { value: 'asap', label: t('contact.form.timelines.asap') },
    { value: '1month', label: t('contact.form.timelines.1month') },
    { value: '3months', label: t('contact.form.timelines.3months') },
    { value: '6months', label: t('contact.form.timelines.6months') },
    { value: 'flexible', label: t('contact.form.timelines.flexible') }
  ];

  const contactInfo = [
    {
      icon: Mail,
      title: t('contact.info.email.title'),
      value: t('contact.info.email.value'),
      description: t('contact.info.email.description')
    },
    {
      icon: Phone,
      title: t('contact.info.phone.title'),
      value: t('contact.info.phone.value'),
      description: t('contact.info.phone.description')
    },
    {
      icon: Clock,
      title: t('contact.info.availability.title'),
      value: t('contact.info.availability.value'),
      description: t('contact.info.availability.description')
    }
  ];

  const advantages = [
    {
      icon: CheckCircle,
      title: t('contact.advantages.response.title'),
      description: t('contact.advantages.response.description')
    },
    {
      icon: MessageCircle,
      title: t('contact.advantages.consultation.title'),
      description: t('contact.advantages.consultation.description')
    },
    {
      icon: Calendar,
      title: t('contact.advantages.quote.title'),
      description: t('contact.advantages.quote.description')
    }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead 
        title="Contact Magellan Studio | Devis Gratuit Site Web sur-mesure"
        description="Contactez Magellan Studio pour votre projet web. Devis gratuit et personnalisé pour sites vitrine, e-commerce, réservation. Réponse sous 24h garantie."
        keywords="contact, devis gratuit, projet web, site internet, consultation, artisan, restaurant, TPE, sur-mesure"
        canonicalUrl="https://magellan-studio.fr/contact"
        structuredData={structuredData}
      />
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-20 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto fade-in">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-trinity-blue mb-6">
                {t('contact.title')}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {t('contact.subtitle')}
              </p>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-8 lg:py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Formulaire */}
              <div className="order-2 lg:order-1">
                <div className="bg-white rounded-3xl shadow-trinity p-8 lg:p-12 fade-in">
                  <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-8">
                    {t('contact.form.title')}
                  </h2>

                   <form onSubmit={handleSubmit} className="space-y-6">
                     {/* Nom */}
                     <div>
                       <Label htmlFor="name">Nom *</Label>
                       <Input
                         id="name"
                         type="text"
                         value={formData.name}
                         onChange={(e) => handleInputChange('name', e.target.value)}
                         placeholder="Votre nom complet"
                         required
                         className="mt-2"
                       />
                     </div>

                     {/* Entreprise */}
                     <div>
                       <Label htmlFor="company">Entreprise</Label>
                       <Input
                         id="company"
                         type="text"
                         value={formData.company}
                         onChange={(e) => handleInputChange('company', e.target.value)}
                         placeholder="Nom de votre entreprise"
                         className="mt-2"
                       />
                     </div>

                     {/* Email */}
                     <div>
                       <Label htmlFor="email">Email *</Label>
                       <Input
                         id="email"
                         type="email"
                         value={formData.email}
                         onChange={(e) => handleInputChange('email', e.target.value)}
                         placeholder="votre@email.com"
                         required
                         className="mt-2"
                       />
                     </div>

                     {/* Téléphone */}
                     <div>
                       <Label htmlFor="phone">Numéro de téléphone</Label>
                       <Input
                         id="phone"
                         type="tel"
                         value={formData.phone}
                         onChange={(e) => handleInputChange('phone', e.target.value)}
                         placeholder="06 XX XX XX XX"
                         className="mt-2"
                       />
                     </div>

                     {/* Type de projet */}
                     <div>
                       <Label htmlFor="projectType">Type de projet *</Label>
                       <Select 
                         value={formData.projectType} 
                         onValueChange={(value) => handleInputChange('projectType', value)}
                       >
                         <SelectTrigger className="mt-2">
                           <SelectValue placeholder="Sélectionnez votre type de projet" />
                         </SelectTrigger>
                         <SelectContent>
                           {projectTypes.map((type) => (
                             <SelectItem key={type.value} value={type.value}>
                               {type.label}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>

                     <Button 
                       type="submit"
                       size="lg"
                       className="btn-trinity-hero w-full group"
                       disabled={isSubmitting}
                     >
                       {isSubmitting ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : (
                         <Send className="mr-2 h-4 w-4" />
                       )}
                       {isSubmitting ? 'Envoi en cours...' : 'Envoyer la demande'}
                     </Button>

                   <p className="text-sm text-muted-foreground text-center mt-4">
                     Vos données sont protégées et ne seront utilisées que pour vous répondre.
                   </p>
                   </form>
                </div>
              </div>

              {/* Informations de contact et Calendly */}
              <div className="order-1 lg:order-2 space-y-8">
                {/* Contact Info */}
                <div className="bg-white rounded-3xl shadow-trinity p-8 fade-in">
                  <h3 className="text-xl font-bold text-trinity-blue mb-6">
                    {t('contact.info.title')}
                  </h3>
                  <div className="space-y-6">
                    {contactInfo.map((info, index) => {
                      const Icon = info.icon;
                      return (
                        <div key={info.title} className="flex items-start">
                          <div className="flex items-center justify-center w-10 h-10 bg-trinity-blue-soft rounded-xl mr-4 flex-shrink-0">
                            <Icon className="w-5 h-5 text-trinity-blue" />
                          </div>
                          <div>
                            <div className="font-semibold text-trinity-blue">
                              {info.title}
                            </div>
            <div className="text-foreground font-medium">
                              {info.title === t('contact.info.phone.title') ? (
                                <a href={`tel:${info.value.replace(/\s/g, '')}`} className="hover:text-trinity-blue transition-colors">
                                  {info.value}
                                </a>
                              ) : info.title === t('contact.info.email.title') ? (
                                <a href={`mailto:${info.value}`} className="hover:text-trinity-blue transition-colors">
                                  {info.value}
                                </a>
                              ) : (
                                info.value
                              )}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {info.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Avantages */}
                <div className="bg-trinity-blue-soft rounded-3xl p-8 fade-in">
                  <h3 className="text-xl font-bold text-trinity-blue mb-6">
                    {t('contact.advantages.title')}
                  </h3>
                  <div className="space-y-6">
                    {advantages.map((advantage, index) => {
                      const Icon = advantage.icon;
                      return (
                        <div key={advantage.title} className="flex items-start">
                          <Icon className="w-5 h-5 text-trinity-blue mr-3 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-trinity-blue mb-1">
                              {advantage.title}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {advantage.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calendly Integration - Séparé du formulaire */}
                <div className="bg-trinity-blue-soft rounded-3xl p-4 lg:p-8 fade-in">
                  <h4 className="text-lg font-semibold text-trinity-blue mb-4 text-center">
                    {t('contact.calendly.title')}
                  </h4>
                  <div className="w-full overflow-hidden rounded-xl bg-white mx-auto max-w-full lg:max-w-2xl">
                    <div 
                      className="calendly-inline-widget" 
                      data-url="https://calendly.com/contact-trinitystudio/rendez-vous-decouverte" 
                      style={{
                        minWidth: "100%",
                        width: "100%", 
                        height: "700px"
                      }}
                    ></div>
                  </div>
                </div>

                {/* Témoignage */}
                <div className="bg-white rounded-3xl shadow-trinity p-8 fade-in">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-trinity-blue-soft rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-trinity-blue font-bold">M</span>
                    </div>
                    <p className="text-muted-foreground italic mb-4">
                      "{t('contact.testimonial.text')}"
                    </p>
                    <div className="font-semibold text-trinity-blue">{t('contact.testimonial.author')}</div>
                    <div className="text-muted-foreground text-sm">{t('contact.testimonial.role')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Contact;