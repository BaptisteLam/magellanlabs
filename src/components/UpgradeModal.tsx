import { useState } from 'react';
import { X, Check, Crown, Zap, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Context hint to show a relevant title ("message" | "publish") */
  context?: 'message' | 'publish';
}

const monthlyFeatures = [
  '50 AI messages per month',
  'Publishing & hosting included',
  'Custom domain name',
  'Professional & responsive design',
  'Email support within 24h',
  'No commitment',
];

const annualFeatures = [
  'All monthly features',
  '2 months free (save ~€26)',
  'Priority access to new features',
  'Single billing, no surprises',
];

export function UpgradeModal({ open, onClose, context = 'message' }: UpgradeModalProps) {
  const { isDark } = useThemeStore();
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);

  if (!open) return null;

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to continue');
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
        toast.error('Payment is not yet configured. Contact support.');
      } else {
        toast.error('Error redirecting to payment. Please try again.');
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  const title = context === 'publish'
    ? 'Publish your site with the Premium plan'
    : 'You have reached your message limit';

  const subtitle = context === 'publish'
    ? 'Publishing is reserved for subscribers. Choose a plan to put your site online.'
    : 'Upgrade to Premium to continue editing your site with AI.';

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden',
          isDark
            ? 'bg-[#0e0e0e] border-[#1f1f1f]'
            : 'bg-white border-slate-200'
        )}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Glow accents */}
        <div
          className="absolute top-0 left-1/4 w-[500px] h-[200px] rounded-full blur-[80px] pointer-events-none"
          style={{ backgroundColor: 'rgba(3,165,192,0.15)' }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 z-10 p-1.5 rounded-full transition-colors',
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-white/10'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'rgba(3,165,192,0.15)' }}
            >
              {context === 'publish' ? (
                <Sparkles className="h-6 w-6" style={{ color: '#03A5C0' }} />
              ) : (
                <Zap className="h-6 w-6" style={{ color: '#03A5C0' }} />
              )}
            </div>
            <h2 className={cn(
              'text-xl sm:text-2xl font-bold mb-2',
              isDark ? 'text-white' : 'text-slate-900'
            )}>
              {title}
            </h2>
            <p className={cn(
              'text-sm sm:text-base',
              isDark ? 'text-slate-400' : 'text-slate-600'
            )}>
              {subtitle}
            </p>
          </div>

          {/* Plans grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly */}
            <div
              className={cn(
                'rounded-xl p-5 border flex flex-col',
                isDark
                  ? 'bg-white/5 border-white/10 hover:border-[#03A5C0]/50'
                  : 'bg-white border-slate-200 hover:border-[#03A5C0]/50',
                'transition-colors'
              )}
            >
              <div className="mb-4">
                <p className={cn(
                  'text-xs font-semibold uppercase tracking-wider mb-1',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}>
                  Monthly
                </p>
                <div className="flex items-baseline gap-1">
                  <span className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                    12,99€
                  </span>
                  <span className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    /month
                  </span>
                </div>
                <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  No commitment
                </p>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {monthlyFeatures.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#03A5C0' }} />
                    <span className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout('monthly')}
                disabled={loadingPlan !== null}
                className="w-full py-2.5 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2 border"
                style={{
                  borderColor: '#03A5C0',
                  backgroundColor: 'rgba(3,165,192,0.12)',
                  color: '#03A5C0',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.22)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.12)';
                }}
              >
                {loadingPlan === 'monthly' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    Choose this plan
                  </>
                )}
              </button>
            </div>

            {/* Annual - highlighted */}
            <div
              className="rounded-xl p-5 border flex flex-col relative overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, rgba(3,165,192,0.15) 0%, rgba(3,165,192,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(3,165,192,0.08) 0%, rgba(3,165,192,0.02) 100%)',
                borderColor: '#03A5C0',
              }}
            >
              {/* Badge */}
              <div
                className="absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg"
                style={{ backgroundColor: '#03A5C0' }}
              >
                POPULAR
              </div>

              <div className="mb-4">
                <p className={cn(
                  'text-xs font-semibold uppercase tracking-wider mb-1',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}>
                  Annual
                </p>
                <div className="flex items-baseline gap-1">
                  <span className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                    119,99€
                  </span>
                  <span className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    /year
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: '#03A5C0' }}>
                  ~€10/month · 2 months free
                </p>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {annualFeatures.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#03A5C0' }} />
                    <span className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout('annual')}
                disabled={loadingPlan !== null}
                className="w-full py-2.5 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2 text-white"
                style={{ backgroundColor: '#03A5C0' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.85)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#03A5C0';
                }}
              >
                {loadingPlan === 'annual' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    Subscribe annually
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Footer note */}
          <p className={cn(
            'text-center text-xs mt-5',
            isDark ? 'text-slate-500' : 'text-slate-400'
          )}>
            Secure payment via Stripe · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
