import { Check } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Pricing = () => {
  const monthlyFeatures = [
    "Création instantanée de votre site par intelligence artificielle",
    "Design professionnel et responsive",
    "Hébergement inclus",
    "Connexion facile à votre propre nom de domaine",
    "Mises à jour illimitées via l'interface",
    "Support par email en 24h",
    "Sans engagement, résiliable à tout moment"
  ];

  const annualFeatures = [
    "Toutes les fonctionnalités de l'offre mensuelle",
    "Tarif avantageux : 2 mois gratuits",
    "Priorité sur les mises à jour et nouveautés",
    "Facturation unique, sans surprise",
    "Idéal pour les pros qui veulent s'installer durablement en ligne"
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="Tarifs - Magellan Studio | Abonnement Site Web dès 9,90€/mois"
        description="Créez votre site professionnel avec l'IA dès 9,90€/mois. Sans engagement, hébergement inclus, mises à jour illimitées. Offre annuelle à 99,90€/an avec 2 mois offerts."
        keywords="tarif site web, abonnement site internet, prix création site, hébergement inclus, site web mensuel"
        canonicalUrl="https://magellan-studio.fr/pricing"
      />
      <Header />
      
      <main className="relative pt-24 pb-16 overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0" 
             style={{ 
               backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
               backgroundSize: '80px 80px'
             }} 
        />
        
        {/* Animated glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow" 
               style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
          <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slower" 
               style={{ backgroundColor: 'rgba(3, 165, 192, 0.3)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse" 
               style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        </div>

        <div className="relative container mx-auto px-4">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Tarifs simples et transparents
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Choisissez l'offre qui correspond à vos besoins. Création instantanée par IA, hébergement inclus, sans surprise.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Monthly Plan */}
            <Card className="p-8 bg-white/40 backdrop-blur-md border border-slate-200/50 hover:bg-white/50 transition-all flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Offre Mensuelle</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900">20€</span>
                  <span className="text-slate-600">/ mois</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {monthlyFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-4 h-4 flex-shrink-0 mt-1 text-slate-700" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full text-white hover:opacity-90 transition-opacity border-0"
                style={{ backgroundColor: '#014AAD' }}
                size="lg"
              >
                Commencer maintenant
              </Button>
            </Card>

            {/* Annual Plan - Popular */}
            <Card className="p-8 bg-white/40 backdrop-blur-md border border-slate-200/50 hover:bg-white/50 transition-all relative overflow-hidden flex flex-col">
              {/* Popular Badge */}
              <div 
                className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5"
              >
                2 MOIS OFFERTS
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Offre Annuelle</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900">200€</span>
                  <span className="text-slate-600">/ an</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">soit 16,67€/mois</p>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {annualFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-4 h-4 flex-shrink-0 mt-1 text-slate-700" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full text-white hover:opacity-90 transition-opacity border-0"
                style={{ backgroundColor: '#014AAD' }}
                size="lg"
              >
                Souscrire à l'offre annuelle
              </Button>
            </Card>
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-16 text-center max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Questions fréquentes</h3>
            <div className="space-y-4 text-left">
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Puis-je changer d'offre en cours d'abonnement ?</h4>
                <p className="text-slate-600">Oui, vous pouvez passer de l'offre mensuelle à l'offre annuelle à tout moment. La différence sera calculée au prorata.</p>
              </div>
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Comment résilier mon abonnement ?</h4>
                <p className="text-slate-600">L'offre mensuelle est sans engagement. Vous pouvez résilier à tout moment depuis votre espace client, sans frais.</p>
              </div>
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Que se passe-t-il après l'abonnement ?</h4>
                <p className="text-slate-600">Votre site reste en ligne tant que votre abonnement est actif. Si vous résiliez, vous aurez accès à une sauvegarde complète de votre site.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Pricing;
