import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Crown, Check, Zap, MessageSquare, Calendar, Loader2, ExternalLink } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const monthlyFeatures = [
  '50 messages IA par mois',
  'Publication & hébergement inclus',
  'Nom de domaine personnalisé',
  'Support par email en 24h',
  'Sans engagement',
];

const annualFeatures = [
  'Toutes les fonctionnalités mensuelles',
  '2 mois offerts (économisez ~26€)',
  'Priorité sur les nouvelles fonctionnalités',
  'Facturation unique',
];

export function Facturation() {
  const { usage, isLoading: creditsLoading } = useCredits();
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  const messagesUsed = usage?.messagesUsed ?? 0;
  const messagesLimit = usage?.messagesLimit ?? 5;
  const isPremium = usage?.plan === 'premium';
  const progressPercentage = messagesLimit > 0 ? (messagesUsed / messagesLimit) * 100 : 0;

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter pour continuer');
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
        toast.error('Le paiement n\'est pas encore configuré. Contactez le support.');
      } else {
        toast.error('Erreur lors de la redirection vers le paiement. Réessayez.');
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    setIsManaging(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter pour continuer');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { action: 'portal' },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.info('Le portail de facturation sera disponible prochainement.');
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      toast.info('Le portail de facturation sera disponible prochainement.');
    } finally {
      setIsManaging(false);
    }
  };

  if (creditsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted/50 rounded animate-pulse w-48" />
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Facturation</h2>
        <p className="text-muted-foreground">Gérez votre abonnement et votre utilisation</p>
      </div>

      {/* Current plan card */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" style={{ color: '#03A5C0' }} />
            Plan actuel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: isPremium ? 'rgba(3,165,192,0.15)' : 'rgba(148,163,184,0.15)',
                  color: isPremium ? '#03A5C0' : '#94a3b8',
                  border: `1px solid ${isPremium ? 'rgba(3,165,192,0.3)' : 'rgba(148,163,184,0.3)'}`,
                }}
              >
                {isPremium ? 'Premium' : 'Gratuit'}
              </div>
              {isPremium && (
                <span className="text-sm text-muted-foreground">
                  {usage?.cycleReset ? `Renouvellement le ${new Date(usage.cycleReset).toLocaleDateString('fr-FR')}` : ''}
                </span>
              )}
            </div>

            {isPremium && (
              <button
                onClick={handleManageBilling}
                disabled={isManaging}
                className="flex items-center gap-2 text-sm transition-colors rounded-full px-4 py-1.5 border"
                style={{
                  borderColor: 'rgba(3,165,192,0.4)',
                  color: '#03A5C0',
                  backgroundColor: 'rgba(3,165,192,0.08)',
                }}
              >
                {isManaging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Gérer l'abonnement
              </button>
            )}
          </div>

          {/* Usage bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Messages utilisés ce mois
              </div>
              <span className="font-medium text-foreground">
                {messagesUsed} / {messagesLimit}
              </span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-muted/50">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: progressPercentage >= 90 ? '#ef4444' : '#03A5C0',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {messagesLimit - messagesUsed} messages restants ce mois-ci
            </p>
          </div>

          {/* Stats row */}
          {isPremium && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: 'rgba(3,165,192,0.06)', border: '1px solid rgba(3,165,192,0.15)' }}
              >
                <Calendar className="h-4 w-4 mx-auto mb-1" style={{ color: '#03A5C0' }} />
                <p className="text-xs text-muted-foreground">Générations ce mois</p>
                <p className="text-lg font-bold text-foreground">{usage?.generationCount ?? 0}</p>
              </div>
              <div
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: 'rgba(3,165,192,0.06)', border: '1px solid rgba(3,165,192,0.15)' }}
              >
                <Zap className="h-4 w-4 mx-auto mb-1" style={{ color: '#03A5C0' }} />
                <p className="text-xs text-muted-foreground">Tokens utilisés</p>
                <p className="text-lg font-bold text-foreground">
                  {usage?.totalTokens ? (usage.totalTokens / 1000).toFixed(1) + 'k' : '0'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade section - only for free users */}
      {!isPremium && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Passer en Premium</h3>
            <p className="text-sm text-muted-foreground">
              Débloquez toutes les fonctionnalités pour créer et publier votre site.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly */}
            <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm flex flex-col">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Mensuel</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">12,99€</span>
                    <span className="text-sm text-muted-foreground">/mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Sans engagement</p>
                </div>

                <ul className="space-y-2 mb-5 flex-1">
                  {monthlyFeatures.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#03A5C0' }} />
                      <span className="text-sm text-foreground/80">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout('monthly')}
                  disabled={loadingPlan !== null}
                  className="w-full py-2.5 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2 border disabled:opacity-60"
                  style={{
                    borderColor: '#03A5C0',
                    backgroundColor: 'rgba(3,165,192,0.1)',
                    color: '#03A5C0',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.1)'; }}
                >
                  {loadingPlan === 'monthly' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Crown className="h-4 w-4" />
                      Commencer
                    </>
                  )}
                </button>
              </CardContent>
            </Card>

            {/* Annual */}
            <Card
              className="rounded-[8px] shadow-sm flex flex-col relative overflow-hidden"
              style={{ border: '1px solid #03A5C0' }}
            >
              <div
                className="absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg"
                style={{ backgroundColor: '#03A5C0' }}
              >
                POPULAIRE
              </div>
              <CardContent className="p-5 flex flex-col h-full">
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Annuel</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">119,99€</span>
                    <span className="text-sm text-muted-foreground">/an</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#03A5C0' }}>
                    soit ~10€/mois · 2 mois offerts
                  </p>
                </div>

                <ul className="space-y-2 mb-5 flex-1">
                  {annualFeatures.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#03A5C0' }} />
                      <span className="text-sm text-foreground/80">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout('annual')}
                  disabled={loadingPlan !== null}
                  className="w-full py-2.5 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2 text-white disabled:opacity-60"
                  style={{ backgroundColor: '#03A5C0' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.85)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#03A5C0'; }}
                >
                  {loadingPlan === 'annual' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Crown className="h-4 w-4" />
                      Souscrire annuellement
                    </>
                  )}
                </button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Paiement sécurisé via Stripe · Résiliable à tout moment
          </p>
        </>
      )}

      {/* Premium user: feature highlights */}
      {isPremium && (
        <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Fonctionnalités incluses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[...monthlyFeatures].map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                  <Check className="h-4 w-4 flex-shrink-0" style={{ color: '#03A5C0' }} />
                  {feat}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
