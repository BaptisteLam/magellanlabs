import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X, Loader2, CheckCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle Stripe redirect success/cancel
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      toast({
        title: language === 'fr' ? 'Paiement réussi !' : 'Payment successful!',
        description: language === 'fr'
          ? 'Votre abonnement Premium est maintenant actif.'
          : 'Your Premium subscription is now active.',
      });
    }
    if (searchParams.get('canceled') === 'true') {
      toast({
        title: language === 'fr' ? 'Paiement annulé' : 'Payment canceled',
        description: language === 'fr'
          ? 'Vous pouvez réessayer quand vous le souhaitez.'
          : 'You can try again whenever you want.',
        variant: 'destructive',
      });
    }
  }, [searchParams]);

  const handleCheckout = async (priceType: 'monthly' | 'annual') => {
    setLoadingPlan(priceType);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        navigate('/auth');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceType,
          successUrl: `${window.location.origin}/pricing?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout or Billing Portal
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: err.message || (language === 'fr' ? 'Une erreur est survenue.' : 'An error occurred.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleFreeSignup = () => {
    navigate('/auth');
  };

  const isFr = language === 'fr';

  const freeFeatures = [
    { text: isFr ? "5 messages IA par mois" : "5 AI messages per month", included: true },
    { text: isFr ? "Création instantanée par IA" : "Instant AI creation", included: true },
    { text: isFr ? "Design professionnel et responsive" : "Professional responsive design", included: true },
    { text: isFr ? "Prévisualisation en temps réel (24h)" : "Real-time preview (24h)", included: true },
    { text: isFr ? "Publication en ligne" : "Online publishing", included: false },
    { text: isFr ? "Connexion nom de domaine" : "Custom domain connection", included: false },
    { text: isFr ? "Support prioritaire" : "Priority support", included: false },
  ];

  const premiumFeatures = [
    { text: isFr ? "50 messages IA par mois" : "50 AI messages per month", included: true },
    { text: isFr ? "Création instantanée par IA" : "Instant AI creation", included: true },
    { text: isFr ? "Design professionnel et responsive" : "Professional responsive design", included: true },
    { text: isFr ? "Prévisualisation illimitée" : "Unlimited preview", included: true },
    { text: isFr ? "Publication en ligne illimitée" : "Unlimited publishing", included: true },
    { text: isFr ? "Connexion à votre propre nom de domaine" : "Connect your own domain", included: true },
    { text: isFr ? "Support prioritaire par email en 24h" : "Priority email support within 24h", included: true },
    { text: isFr ? "Sans engagement, résiliable à tout moment" : "No commitment, cancel anytime", included: true },
  ];

  const annualFeatures = isFr ? [
    "Toutes les fonctionnalités Premium",
    "Tarif avantageux : 2 mois gratuits",
    "Priorité sur les mises à jour et nouveautés",
    "Facturation unique annuelle, sans surprise",
    "Idéal pour les pros qui veulent s'installer durablement en ligne"
  ] : [
    "All Premium features",
    "Best value: 2 months free",
    "Priority access to updates",
    "Simple annual billing, no surprises",
    "Ideal for professionals building a lasting online presence"
  ];

  // Success banner after Stripe redirect
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-white">
        <SEOHead title={isFr ? "Merci ! - Magellan" : "Thank you! - Magellan"} description="" />
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 text-center max-w-lg">
            <CheckCircle className="w-16 h-16 mx-auto mb-6" style={{ color: '#03A5C0' }} />
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              {isFr ? 'Bienvenue en Premium !' : 'Welcome to Premium!'}
            </h1>
            <p className="text-slate-600 mb-8">
              {isFr
                ? 'Votre abonnement est maintenant actif. Vous avez accès à 50 messages par mois et à la publication illimitée.'
                : 'Your subscription is now active. You have access to 50 messages per month and unlimited publishing.'}
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              className="text-white border-0"
              style={{ backgroundColor: '#03A5C0' }}
              size="lg"
            >
              {isFr ? 'Aller au tableau de bord' : 'Go to Dashboard'}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title={isFr ? "Tarifs - Magellan | Abonnement dès 12,99€/mois" : "Pricing - Magellan | Plans from €12.99/month"}
        description={isFr
          ? "Créez votre site professionnel avec l'IA dès 12,99€/mois. Sans engagement, hébergement inclus."
          : "Create your professional website with AI from €12.99/month. No commitment, hosting included."}
        keywords={isFr ? "tarif site web, abonnement, prix création site" : "website pricing, subscription, site creation cost"}
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
        </div>

        <div className="relative container mx-auto px-4">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {isFr ? 'Tarifs simples et transparents' : 'Simple, transparent pricing'}
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {isFr
                ? 'Commencez gratuitement, passez en Premium quand vous êtes prêt à publier.'
                : 'Start for free, upgrade to Premium when you\'re ready to publish.'}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="p-8 bg-white/40 backdrop-blur-md border border-slate-200/50 hover:bg-white/50 transition-all flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{isFr ? 'Gratuit' : 'Free'}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900">{isFr ? '0€' : '€0'}</span>
                  <span className="text-slate-600">/ {isFr ? 'mois' : 'month'}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{isFr ? 'Pour découvrir la plateforme' : 'Discover the platform'}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {freeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="w-4 h-4 flex-shrink-0 mt-1 text-slate-700" />
                    ) : (
                      <X className="w-4 h-4 flex-shrink-0 mt-1 text-slate-300" />
                    )}
                    <span className={`text-sm ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={handleFreeSignup}
                className="w-full hover:opacity-90 transition-opacity border"
                variant="outline"
                size="lg"
              >
                {isFr ? 'Commencer gratuitement' : 'Get started free'}
              </Button>
            </Card>

            {/* Premium Monthly Plan */}
            <Card className="p-8 bg-white/40 backdrop-blur-md border-2 hover:bg-white/50 transition-all relative overflow-hidden flex flex-col" style={{ borderColor: '#03A5C0' }}>
              <div
                className="absolute top-0 right-0 text-white text-xs font-semibold px-3 py-1.5"
                style={{ backgroundColor: '#03A5C0' }}
              >
                {isFr ? 'POPULAIRE' : 'POPULAR'}
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Premium</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900">{isFr ? '12,99€' : '€12.99'}</span>
                  <span className="text-slate-600">/ {isFr ? 'mois' : 'month'}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{isFr ? 'Pour publier et grandir en ligne' : 'Publish and grow online'}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: '#03A5C0' }} />
                    <span className="text-sm text-slate-700">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleCheckout('monthly')}
                disabled={loadingPlan !== null}
                className="w-full text-white hover:opacity-90 transition-opacity border-0"
                style={{ backgroundColor: '#03A5C0' }}
                size="lg"
              >
                {loadingPlan === 'monthly' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isFr ? 'Redirection...' : 'Redirecting...'}</>
                ) : (
                  isFr ? 'Passer en Premium' : 'Upgrade to Premium'
                )}
              </Button>
            </Card>

            {/* Annual Plan */}
            <Card className="p-8 bg-white/40 backdrop-blur-md border border-slate-200/50 hover:bg-white/50 transition-all relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5">
                {isFr ? '2 MOIS OFFERTS' : '2 MONTHS FREE'}
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{isFr ? 'Premium Annuel' : 'Premium Annual'}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900">{isFr ? '129,90€' : '€129.90'}</span>
                  <span className="text-slate-600">/ {isFr ? 'an' : 'year'}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{isFr ? 'soit 10,83€/mois' : '€10.83/month'}</p>
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
                onClick={() => handleCheckout('annual')}
                disabled={loadingPlan !== null}
                className="w-full text-white hover:opacity-90 transition-opacity border-0"
                style={{ backgroundColor: '#014AAD' }}
                size="lg"
              >
                {loadingPlan === 'annual' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isFr ? 'Redirection...' : 'Redirecting...'}</>
                ) : (
                  isFr ? "Souscrire à l'offre annuelle" : 'Subscribe to annual plan'
                )}
              </Button>
            </Card>
          </div>

          {/* FAQ */}
          <div className="mt-16 text-center max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              {isFr ? 'Questions fréquentes' : 'Frequently asked questions'}
            </h3>
            <div className="space-y-4 text-left">
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">{isFr ? 'Puis-je essayer gratuitement ?' : 'Can I try for free?'}</h4>
                <p className="text-slate-600">
                  {isFr
                    ? 'Oui, le plan Gratuit vous donne 5 messages IA par mois pour tester la plateforme. Passez en Premium quand vous êtes prêt à publier votre site.'
                    : 'Yes, the Free plan gives you 5 AI messages per month to test the platform. Upgrade to Premium when you\'re ready to publish.'}
                </p>
              </div>
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">{isFr ? "Puis-je changer d'offre en cours d'abonnement ?" : 'Can I change plans mid-subscription?'}</h4>
                <p className="text-slate-600">
                  {isFr
                    ? "Oui, vous pouvez passer de l'offre mensuelle à l'offre annuelle à tout moment. La différence sera calculée au prorata."
                    : 'Yes, you can switch from monthly to annual at any time. The difference will be prorated.'}
                </p>
              </div>
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">{isFr ? 'Comment résilier mon abonnement ?' : 'How do I cancel my subscription?'}</h4>
                <p className="text-slate-600">
                  {isFr
                    ? "L'offre Premium est sans engagement. Vous pouvez résilier à tout moment depuis votre espace client, sans frais."
                    : 'Premium has no commitment. You can cancel anytime from your account settings, free of charge.'}
                </p>
              </div>
              <div className="p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">{isFr ? 'Que se passe-t-il après résiliation ?' : 'What happens after cancellation?'}</h4>
                <p className="text-slate-600">
                  {isFr
                    ? 'Votre site reste en ligne tant que votre abonnement est actif. Si vous résiliez, vous gardez accès à une sauvegarde complète de votre site.'
                    : 'Your site stays online as long as your subscription is active. If you cancel, you keep full access to your site backup.'}
                </p>
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
