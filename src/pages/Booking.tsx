import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useState } from 'react';
import { 
  Clock, 
  CheckCircle,
  User,
  Calendar as CalendarIcon,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Booking = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [step, setStep] = useState(1);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ReservationAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://trinity-studio.fr/booking",
      "actionPlatform": [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform"
      ]
    },
    "object": {
      "@type": "Service",
      "name": "Appel découverte Trinity Studio",
      "description": "Consultation gratuite de 30 minutes pour discuter de votre projet web"
    },
    "provider": {
      "@type": "Organization",
      "name": "Trinity Studio"
    }
  };

  // Créneaux disponibles avec quelques créneaux occupés pour l'effet psychologique
  const availableSlots = [
    { time: '09:00', available: true },
    { time: '09:30', available: false }, // Occupé
    { time: '10:00', available: true },
    { time: '10:30', available: true },
    { time: '11:00', available: false }, // Occupé
    { time: '11:30', available: true },
    { time: '14:00', available: true },
    { time: '14:30', available: false }, // Occupé
    { time: '15:00', available: true },
    { time: '15:30', available: true },
    { time: '16:00', available: true },
    { time: '16:30', available: false }, // Occupé
    { time: '17:00', available: true },
  ];

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(2);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen">
      <SEOHead 
        title="Réserver un Appel Découverte | Consultation Gratuite Projet Web"
        description="Réservez un appel gratuit de 30 minutes avec Trinity Studio. Discutons de votre projet web, obtenez des conseils personnalisés et un devis sur-mesure. Sans engagement."
        keywords="réservation, appel découverte, consultation gratuite, rendez-vous web, devis projet, conseil web, artisan, restaurant"
        canonicalUrl="https://trinity-studio.fr/booking"
        structuredData={structuredData}
      />
      <Header />
      
      <main className="pt-24 pb-20 lg:pt-32 lg:pb-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 fade-in">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-trinity-blue mb-6">
              Réserver un appel découverte
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Discutons de votre projet lors d'un appel de 30 minutes. 
              Gratuit et sans engagement.
            </p>
          </div>

          {step === 1 && (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* Calendrier */}
                <div className="fade-in">
                  <h2 className="text-2xl font-bold text-trinity-blue mb-6">
                    Choisissez une date
                  </h2>
                  <div className="bg-white rounded-3xl shadow-trinity p-6">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Créneaux horaires */}
                <div className="fade-in">
                  <h2 className="text-2xl font-bold text-trinity-blue mb-6">
                    Créneaux disponibles
                  </h2>
                  
                  {selectedDate && (
                    <div className="mb-6">
                      <p className="text-muted-foreground">
                        <CalendarIcon className="w-4 h-4 inline mr-2" />
                        {formatDate(selectedDate)}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && handleTimeSelect(slot.time)}
                        disabled={!slot.available}
                        className={`
                          p-3 rounded-xl text-sm font-medium transition-all duration-200
                          ${slot.available 
                            ? 'bg-white border-2 border-trinity-blue-muted text-trinity-blue hover:border-trinity-blue hover:bg-trinity-blue hover:text-white shadow-sm hover:shadow-md' 
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                          }
                        `}
                      >
                        <Clock className="w-4 h-4 inline mr-1" />
                        {slot.time}
                        {!slot.available && (
                          <div className="text-xs text-gray-400 mt-1">Occupé</div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 p-4 bg-trinity-blue-soft rounded-xl">
                    <h3 className="font-semibold text-trinity-blue mb-2">
                      Ce que nous verrons ensemble :
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Analyse de vos besoins spécifiques</li>
                      <li>• Présentation de solutions adaptées</li>
                      <li>• Estimation budgétaire personnalisée</li>
                      <li>• Planning de réalisation</li>
                    </ul>
                  </div>

                  <div className="mt-6 text-center">
                    <div className="inline-flex items-center text-sm text-muted-foreground bg-white px-4 py-2 rounded-lg shadow-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Appel gratuit • 30 minutes • Sans engagement
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-2xl mx-auto fade-in">
              <div className="bg-white rounded-3xl shadow-trinity p-8 lg:p-12">
                {/* Récapitulatif */}
                <div className="text-center mb-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-trinity-blue mb-2">
                    Créneau sélectionné !
                  </h2>
                  <div className="bg-trinity-blue-soft p-4 rounded-xl">
                    <p className="text-trinity-blue font-semibold">
                      {formatDate(selectedDate)} à {selectedTime}
                    </p>
                  </div>
                </div>

                {/* Informations de contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-trinity-blue">
                    Pour finaliser votre réservation
                  </h3>
                  
                  <p className="text-muted-foreground">
                    Cliquez sur le bouton ci-dessous pour accéder à notre formulaire 
                    de contact complet et nous indiquer vos coordonnées.
                  </p>

                  <div className="bg-trinity-blue-soft p-4 rounded-xl">
                    <div className="flex items-start">
                      <User className="w-5 h-5 text-trinity-blue mr-3 mt-0.5" />
                      <div>
                        <p className="font-medium text-trinity-blue mb-1">
                          Alexandre Dupont
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Fondateur & Directeur Technique Trinity Studio
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="btn-trinity-outline"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Changer l'horaire
                  </Button>
                  
                  <Button 
                    asChild 
                    className="btn-trinity-hero group flex-1"
                  >
                    <Link 
                      to={`/contact?date=${selectedDate?.toISOString()}&time=${selectedTime}`}
                    >
                      Finaliser la réservation
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Statistiques de confiance */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 text-center">
            <div className="fade-in">
              <div className="text-2xl font-bold text-trinity-blue mb-2">98%</div>
              <div className="text-muted-foreground text-sm">Taux de satisfaction</div>
            </div>
            <div className="fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="text-2xl font-bold text-trinity-blue mb-2">30min</div>
              <div className="text-muted-foreground text-sm">Durée de l'appel</div>
            </div>
            <div className="fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="text-2xl font-bold text-trinity-blue mb-2">0€</div>
              <div className="text-muted-foreground text-sm">Coût de l'appel</div>
            </div>
            <div className="fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="text-2xl font-bold text-trinity-blue mb-2">24h</div>
              <div className="text-muted-foreground text-sm">Devis sous</div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Booking;