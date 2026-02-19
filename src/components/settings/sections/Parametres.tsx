import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThemeStore } from '@/stores/themeStore';
import { Settings, Moon, Sun, Monitor, Zap, Crown, MessageSquare, LogOut } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useCredits } from '@/hooks/useCredits';
import { supabase } from '@/integrations/supabase/client';

export function Parametres() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const [themeMode, setThemeMode] = useState(isDark ? 'dark' : 'light');
  const [language, setLanguage] = useState('fr');
  const [autoSave, setAutoSave] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { usage, isLoading: creditsLoading } = useCredits();

  const messagesUsed = usage?.messagesUsed ?? 0;
  const messagesLimit = usage?.messagesLimit ?? 5;
  const isPremium = usage?.plan === 'premium';

  const handleThemeChange = (mode: string) => {
    setThemeMode(mode as 'light' | 'dark');
    if ((mode === 'dark' && !isDark) || (mode === 'light' && isDark)) {
      toggleTheme();
    }
  };

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const progressPercentage = messagesLimit > 0 ? (messagesUsed / messagesLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Paramètres</h2>
        <p className="text-muted-foreground">Configurez vos préférences générales</p>
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
            Abonnement
          </CardTitle>
        </CardHeader>
        <CardContent className="relative space-y-6">
          {/* Current Plan */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Plan actuel</p>
              <p className="text-lg font-semibold text-foreground">
                {creditsLoading ? '...' : isPremium ? 'Premium' : 'Gratuit'}
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
                Limité
              </div>
            )}
          </div>

          {/* Messages Counter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Messages utilisés</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {creditsLoading ? '...' : `${messagesUsed} / ${messagesLimit}`}
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
              {creditsLoading ? '...' : `${messagesLimit - messagesUsed} messages restants ce mois-ci`}
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
                  <h4 className="font-semibold text-foreground">Passez en Premium</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Débloquez <span className="font-semibold" style={{ color: '#03A5C0' }}>50 messages/mois</span> et accédez à toutes les fonctionnalités avancées.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-foreground">20€</span>
                  <span className="text-sm text-muted-foreground">/mois</span>
                </div>
                <button
                  onClick={handleUpgradeClick}
                  className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all rounded-full px-6 py-2 gap-2"
                  style={{
                    borderColor: 'rgb(3,165,192)',
                    backgroundColor: 'rgb(3,165,192)',
                    color: 'white',
                    border: '1px solid rgb(3,165,192)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.85)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgb(3,165,192)';
                  }}
                >
                  <Crown className="h-4 w-4" />
                  Passer en Premium
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Apparence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme" className="text-foreground">
              Thème
            </Label>
            <Select value={themeMode} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-[180px] rounded-[8px]">
                <SelectValue placeholder="Sélectionner un thème" />
              </SelectTrigger>
              <SelectContent className="rounded-[8px]">
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Clair
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Sombre
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Système
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle>Langue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="language" className="text-foreground">
              Langue de l'interface
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[180px] rounded-[8px]">
                <SelectValue placeholder="Sélectionner une langue" />
              </SelectTrigger>
              <SelectContent className="rounded-[8px]">
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle>Sauvegarde automatique</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save" className="text-foreground">
                Activer la sauvegarde automatique
              </Label>
              <p className="text-sm text-muted-foreground">
                Sauvegarde automatiquement vos modifications
              </p>
            </div>
            <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
        </CardContent>
      </Card>

      {/* Logout Card */}
      <Card className="rounded-[8px] border border-red-500/20 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <LogOut className="h-5 w-5" />
            Déconnexion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm text-foreground font-medium">Se déconnecter du compte</p>
              <p className="text-sm text-muted-foreground">
                Vous serez redirigé vers la page d'inscription
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all rounded-full px-6 py-2 gap-2 disabled:opacity-50"
              style={{
                borderColor: 'rgb(239,68,68)',
                backgroundColor: 'transparent',
                color: 'rgb(239,68,68)',
                border: '1px solid rgb(239,68,68)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
