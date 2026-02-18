import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThemeStore } from '@/stores/themeStore';
import { Settings, Moon, Sun, Monitor, Zap, Crown, MessageSquare, Loader2, Badge } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useCredits } from '@/hooks/useCredits';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function Parametres() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const { language, setLanguage } = useTranslation();
  const { toast } = useToast();
  const [themeMode, setThemeMode] = useState(isDark ? 'dark' : 'light');
  const [autoSave, setAutoSave] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Real subscription data from billing table
  const { usage, isLoading: creditsLoading, planInfo, percentUsed } = useCredits();

  const isPremium = usage?.plan === 'premium';
  const messagesUsed = usage?.messagesUsed || 0;
  const messagesLimit = usage?.messagesLimit || 5;
  const isFr = language === 'fr';

  const handleThemeChange = (mode: string) => {
    setThemeMode(mode as 'light' | 'dark');
    if ((mode === 'dark' && !isDark) || (mode === 'light' && isDark)) {
      toggleTheme();
    }
  };

  const handleUpgradeClick = async () => {
    setUpgradeLoading(true);
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
          priceType: 'monthly',
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
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast({
        title: isFr ? 'Erreur' : 'Error',
        description: err.message || (isFr ? 'Une erreur est survenue.' : 'An error occurred.'),
        variant: 'destructive',
      });
    } finally {
      setUpgradeLoading(false);
    }
  };

  const progressPercentage = messagesLimit > 0 ? (messagesUsed / messagesLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{isFr ? 'Paramètres' : 'Settings'}</h2>
        <p className="text-muted-foreground">{isFr ? 'Configurez vos préférences générales' : 'Configure your general preferences'}</p>
      </div>

      {/* Subscription Card */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: 'linear-gradient(135deg, rgba(3,165,192,0.3) 0%, transparent 50%)'
          }}
        />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" style={{ color: '#03A5C0' }} />
            {isFr ? 'Abonnement' : 'Subscription'}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative space-y-6">
          {creditsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{isFr ? 'Chargement...' : 'Loading...'}</span>
            </div>
          ) : (
            <>
              {/* Current Plan */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isFr ? 'Plan actuel' : 'Current plan'}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {isPremium ? 'Premium' : (isFr ? 'Gratuit' : 'Free')}
                  </p>
                </div>
                {!isPremium && (
                  <div
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(3,165,192,0.15)',
                      color: '#03A5C0',
                      border: '1px solid rgba(3,165,192,0.3)'
                    }}
                  >
                    {isFr ? 'Limité' : 'Limited'}
                  </div>
                )}
                {isPremium && (
                  <div
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(3,165,192,0.15)',
                      color: '#03A5C0',
                      border: '1px solid rgba(3,165,192,0.3)'
                    }}
                  >
                    {isFr ? 'Actif' : 'Active'}
                  </div>
                )}
              </div>

              {/* Messages Counter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{isFr ? 'Messages utilisés' : 'Messages used'}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {messagesUsed} / {messagesLimit}
                  </span>
                </div>

                <div className="relative">
                  <Progress
                    value={progressPercentage}
                    className="h-3 bg-muted/50"
                  />
                  <div
                    className="absolute inset-0 h-3 rounded-full overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, #03A5C0 0%, #03A5C0 ${progressPercentage}%, transparent ${progressPercentage}%)`,
                      opacity: 0.8
                    }}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? `${Math.max(0, messagesLimit - messagesUsed)} messages restants ce mois-ci`
                    : `${Math.max(0, messagesLimit - messagesUsed)} messages remaining this month`}
                </p>
              </div>

              {/* Upgrade Section */}
              {!isPremium && (
                <div
                  className="rounded-xl p-4 space-y-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(3,165,192,0.1) 0%, rgba(3,165,192,0.05) 100%)',
                    border: '1px solid rgba(3,165,192,0.2)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: 'rgba(3,165,192,0.15)' }}
                    >
                      <Zap className="h-5 w-5" style={{ color: '#03A5C0' }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{isFr ? 'Passez en Premium' : 'Upgrade to Premium'}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isFr
                          ? <>Débloquez <span className="font-semibold" style={{ color: '#03A5C0' }}>50 messages/mois</span>, la publication de vos sites et toutes les fonctionnalités avancées.</>
                          : <>Unlock <span className="font-semibold" style={{ color: '#03A5C0' }}>50 messages/month</span>, site publishing, and all advanced features.</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-foreground">{isFr ? '12,99€' : '€12.99'}</span>
                      <span className="text-sm text-muted-foreground">/{isFr ? 'mois' : 'month'}</span>
                    </div>
                    <button
                      onClick={handleUpgradeClick}
                      disabled={upgradeLoading}
                      className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all rounded-full px-6 py-2 gap-2 disabled:opacity-60"
                      style={{
                        borderColor: 'rgb(3,165,192)',
                        backgroundColor: 'rgb(3,165,192)',
                        color: 'white',
                        border: '1px solid rgb(3,165,192)'
                      }}
                      onMouseEnter={(e) => {
                        if (!upgradeLoading) e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.85)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgb(3,165,192)';
                      }}
                    >
                      {upgradeLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4" />
                      )}
                      {isFr ? 'Passer en Premium' : 'Upgrade to Premium'}
                    </button>
                  </div>
                </div>
              )}

              {/* Manage subscription for premium users */}
              {isPremium && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {isFr ? 'Gérer votre abonnement' : 'Manage your subscription'}
                  </p>
                  <button
                    onClick={handleUpgradeClick}
                    className="text-sm font-medium hover:underline"
                    style={{ color: '#03A5C0' }}
                  >
                    {isFr ? 'Ouvrir le portail de facturation' : 'Open billing portal'}
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {isFr ? 'Apparence' : 'Appearance'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme" className="text-foreground">
              {isFr ? 'Thème' : 'Theme'}
            </Label>
            <Select value={themeMode} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-[180px] rounded-[8px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[8px]">
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    {isFr ? 'Clair' : 'Light'}
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    {isFr ? 'Sombre' : 'Dark'}
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    {isFr ? 'Système' : 'System'}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle>{isFr ? 'Langue' : 'Language'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="language" className="text-foreground">
              {isFr ? "Langue de l'interface" : 'Interface language'}
            </Label>
            <Select value={language} onValueChange={(val) => setLanguage(val as 'fr' | 'en')}>
              <SelectTrigger className="w-[180px] rounded-[8px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[8px]">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle>{isFr ? 'Sauvegarde automatique' : 'Auto-save'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save" className="text-foreground">
                {isFr ? 'Activer la sauvegarde automatique' : 'Enable auto-save'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isFr ? 'Sauvegarde automatiquement vos modifications' : 'Automatically saves your changes'}
              </p>
            </div>
            <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
        </CardContent>
      </Card>

      {/* Badge "Built By Magellan" Card */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge className="h-5 w-5" />
            {isFr ? 'Badge "Built By Magellan"' : '"Built By Magellan" Badge'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="badge-toggle" className="text-foreground">
                {isFr ? 'Afficher le badge sur vos sites publiés' : 'Show badge on your published sites'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isPremium
                  ? (isFr ? 'En tant qu\'utilisateur Premium, le badge est désactivé.' : 'As a Premium user, the badge is disabled.')
                  : (isFr ? 'Le badge est obligatoire avec le plan gratuit. Passez en Premium pour le retirer.' : 'The badge is required on the free plan. Upgrade to Premium to remove it.')
                }
              </p>
            </div>
            <Switch
              id="badge-toggle"
              checked={!isPremium}
              disabled={isPremium}
              onCheckedChange={(checked) => {
                if (!checked && !isPremium) {
                  navigate('/pricing');
                }
              }}
            />
          </div>
          {!isPremium && (
            <div
              className="mt-4 rounded-lg p-3 flex items-center gap-3"
              style={{
                backgroundColor: 'rgba(3,165,192,0.06)',
                border: '1px solid rgba(3,165,192,0.15)'
              }}
            >
              <Crown className="h-4 w-4 flex-shrink-0" style={{ color: '#03A5C0' }} />
              <p className="text-xs text-muted-foreground flex-1">
                {isFr
                  ? 'Passez en Premium pour supprimer le badge de vos sites.'
                  : 'Upgrade to Premium to remove the badge from your sites.'}
              </p>
              <button
                onClick={() => navigate('/pricing')}
                className="text-xs font-medium whitespace-nowrap px-3 py-1 rounded-full"
                style={{ backgroundColor: '#03A5C0', color: 'white' }}
              >
                {isFr ? 'Passer en Premium' : 'Upgrade'}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
