import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Pricing = () => {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);

  const monthlyFeatures = [
    "Instant website creation powered by artificial intelligence",
    "Professional and responsive design",
    "Hosting included",
    "Easy connection to your own domain name",
    "50 AI messages per month",
    "Email support within 24 hours",
    "No commitment, cancel anytime"
  ];

  const annualFeatures = [
    "All features from the monthly plan",
    "Great value: 2 months free",
    "Priority access to updates and new features",
    "Single billing, no surprises",
    "Ideal for professionals who want a lasting online presence"
  ];

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan);
    try {
      // If not logged in, save the intent and redirect to auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        localStorage.setItem('redirectAfterAuth', '/tarifs');
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      if (err?.message?.includes('not configured')) {
        toast.error('Payment is not yet configured. Please contact support.');
      } else {
        toast.error('Error redirecting to payment. Please try again.');
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Pricing - Magellan | AI Website Subscription from 12.99€/month"
        description="Create your professional website with AI from 12.99€/month. No commitment, hosting included, 50 AI messages/month. Annual plan at 119.99€/year with 2 months free."
        keywords="website pricing, website subscription, AI website creation price, hosting included, monthly website"
        canonicalUrl="https://magellanlabs.com/pricing"
      />
      <Header />

      <main className="relative pt-16 sm:pt-24 pb-12 sm:pb-16 overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0"
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

        <div className="relative container mx-auto px-4 sm:px-6">
          {/* Header Section */}
          <div className="text-center mb-10 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-3 sm:mb-4">
              Simple and transparent pricing
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto px-2">
              Choose the plan that fits your needs. Instant AI creation, hosting included, no surprises.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {/* Monthly Plan */}
            <Card className="p-5 sm:p-8 bg-white/40 backdrop-blur-md border border-slate-200/50 hover:bg-white/50 transition-all flex flex-col">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Monthly Plan</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-slate-900">12.99€</span>
                  <span className="text-slate-600">/ month</span>
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
                onClick={() => handleCheckout('monthly')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'monthly' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  'Get started now'
                )}
              </Button>
            </Card>

            {/* Annual Plan - Popular */}
            <Card className="p-5 sm:p-8 bg-white/40 backdrop-blur-md border border-slate-200/50 hover:bg-white/50 transition-all relative overflow-hidden flex flex-col">
              {/* Popular Badge */}
              <div className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5">
                2 MONTHS FREE
              </div>

              <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Annual Plan</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-slate-900">119.99€</span>
                  <span className="text-slate-600">/ year</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">i.e. ~10€/month</p>
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
                onClick={() => handleCheckout('annual')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'annual' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  'Subscribe to the annual plan'
                )}
              </Button>
            </Card>
          </div>

          {/* FAQ */}
          <div className="mt-10 sm:mt-16 text-center max-w-3xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h3>
            <div className="space-y-3 sm:space-y-4 text-left">
              <div className="p-4 sm:p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Can I switch plans during my subscription?</h4>
                <p className="text-slate-600">Yes, you can switch from the monthly plan to the annual plan at any time. The difference will be prorated.</p>
              </div>
              <div className="p-4 sm:p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">How do I cancel my subscription?</h4>
                <p className="text-slate-600">The monthly plan has no commitment. You can cancel at any time from your account dashboard, free of charge.</p>
              </div>
              <div className="p-4 sm:p-6 bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">What happens after the subscription ends?</h4>
                <p className="text-slate-600">Your website stays online as long as your subscription is active. If you cancel, you will have access to a full backup of your website.</p>
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
