import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useThemeStore } from '@/stores/themeStore';
import { Separator } from "@/components/ui/separator";
import Header from "@/components/layout/Header";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useThemeStore();
  const [isLogin, setIsLogin] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    // Vérifier la configuration Supabase au démarrage
    const checkSupabaseConfig = async () => {
      try {
        // Test simple pour vérifier que Supabase est accessible
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('❌ Supabase connection error:', error);
          if (error.message?.includes('Invalid API key') || error.message?.includes('Invalid URL')) {
            toast.error('Configuration Supabase invalide. Vérifiez les variables d\'environnement.');
          }
        } else {
          console.log('✅ Supabase connection OK');
        }
      } catch (e) {
        console.error('❌ Supabase unreachable:', e);
        toast.error('Impossible de se connecter à Supabase. Vérifiez votre connexion.');
      }
    };

    checkSupabaseConfig();

    // Gérer les erreurs OAuth dans l'URL (ex: error=access_denied)
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('OAuth error:', error, errorDescription);
      toast.error(errorDescription || `Erreur d'authentification: ${error}`);
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/auth');
    }

    // Vérifier si l'utilisateur est déjà connecté
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        return;
      }

      if (session) {
        console.log('✅ User already logged in:', session.user.email);
        // S'assurer que le profil existe avant de rediriger
        await ensureUserProfile(session.user);
        handleRedirectAfterAuth();
      }
    };

    checkSession();

    // Écouter les changements d'authentification (important pour OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);

      if (event === 'SIGNED_IN' && session) {
        // S'assurer que le profil utilisateur existe (fallback si le trigger DB échoue)
        await ensureUserProfile(session.user);
        toast.success(`Bienvenue ${session.user.email}!`);
        handleRedirectAfterAuth();
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  // Vérifie et crée le profil utilisateur si nécessaire (fallback si le trigger DB échoue)
  const ensureUserProfile = async (user: { id: string; email?: string }) => {
    try {
      // Vérifier si le profil existe
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Error checking profile:', fetchError);
        return;
      }

      // Si le profil n'existe pas, le créer
      if (!profile) {
        console.log('📝 Creating missing profile for user:', user.email);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
          });

        if (insertError) {
          console.error('❌ Error creating profile:', insertError);
        } else {
          console.log('✅ Profile created successfully');
        }
      } else {
        console.log('✅ Profile exists for user:', user.email);
      }
    } catch (error) {
      console.error('❌ ensureUserProfile error:', error);
    }
  };

  const handleRedirectAfterAuth = () => {
    const redirectPath = localStorage.getItem('redirectAfterAuth');
    if (redirectPath) {
      localStorage.removeItem('redirectAfterAuth');
      navigate(redirectPath);
    } else {
      navigate("/");
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setOauthLoading(provider);

    try {
      // Construire l'URL de redirection - utiliser /auth pour capturer le callback
      const redirectUrl = `${window.location.origin}/auth`;

      console.log(`🚀 Starting ${provider} OAuth flow...`);
      console.log('📍 Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          // Pour Apple, ajouter les scopes nécessaires
          ...(provider === 'apple' && {
            scopes: 'email name',
          }),
          // Pour Google, demander le profil complet
          ...(provider === 'google' && {
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          }),
        },
      });

      if (error) {
        console.error(`❌ ${provider} OAuth error:`, error);
        throw error;
      }

      if (data?.url) {
        console.log(`✅ Redirecting to ${provider}:`, data.url);
        // La redirection est gérée automatiquement par Supabase
      }
    } catch (error: any) {
      console.error('OAuth error:', error);

      // Messages d'erreur personnalisés
      let errorMessage = error.message || "Une erreur est survenue";

      if (error.message?.includes('provider is not enabled')) {
        errorMessage = `L'authentification ${provider === 'google' ? 'Google' : 'Apple'} n'est pas encore configurée. Contactez l'administrateur.`;
      } else if (error.message?.includes('redirect_uri_mismatch')) {
        errorMessage = "Erreur de configuration. L'URL de redirection n'est pas autorisée.";
      }

      toast.error(errorMessage);
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Veuillez entrer votre adresse email");
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Un lien de réinitialisation a été envoyé à votre adresse email. Vérifiez votre boîte mail.");
      setIsForgotPassword(false);
    } catch (error: any) {
      console.error('❌ Forgot password error:', error);
      toast.error(error.message?.includes('rate limit') ? "Trop de tentatives. Réessayez dans quelques minutes." : "Erreur lors de l'envoi de l'email. Vérifiez l'adresse saisie.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Connexion réussie !");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (error) throw error;

        console.log('📧 Signup response:', {
          user: data.user?.id,
          session: !!data.session,
          confirmationSentAt: data.user?.confirmation_sent_at,
          emailConfirmedAt: data.user?.email_confirmed_at,
        });

        // Vérifier si l'utilisateur a déjà une session (confirmation d'email désactivée)
        if (data.session) {
          toast.success("Compte créé avec succès ! Vous êtes connecté.");
        } else if (data.user && !data.user.email_confirmed_at) {
          toast.success("Compte créé ! Vérifiez votre boîte mail pour confirmer votre inscription.");
        } else {
          toast.success("Compte créé !");
        }
      }
    } catch (error: any) {
      console.error('❌ Auth error:', error);

      // Messages d'erreur personnalisés en français
      let errorMessage = error.message;

      // Erreurs de connexion
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = "Email ou mot de passe incorrect";
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = "Veuillez confirmer votre email avant de vous connecter";
      }
      // Erreurs d'inscription
      else if (error.message?.includes('User already registered')) {
        errorMessage = "Un compte existe déjà avec cet email";
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = "Le mot de passe doit contenir au moins 6 caractères";
      } else if (error.message?.includes('Unable to validate email address')) {
        errorMessage = "Adresse email invalide";
      } else if (error.message?.includes('Signups not allowed')) {
        errorMessage = "Les inscriptions sont désactivées. Contactez l'administrateur.";
      } else if (error.message?.includes('Email rate limit exceeded')) {
        errorMessage = "Trop de tentatives. Veuillez réessayer plus tard.";
      } else if (error.message?.includes('Database error')) {
        errorMessage = "Erreur de base de données. Veuillez réessayer.";
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = "Erreur de connexion au serveur. Vérifiez votre connexion internet.";
      } else if (error.message?.includes('AuthApiError')) {
        errorMessage = "Erreur d'authentification. Veuillez réessayer.";
      }

      console.error('📋 Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details,
      });

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = loading || oauthLoading !== null;

  return (
    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden pt-20">
      {/* Grid background - adapté au thème */}
      <div className="absolute inset-0"
           style={{
             backgroundImage: isDark
               ? 'linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)'
               : 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px',
             backgroundColor: isDark ? '#1F1F20' : '#ffffff'
           }}
      />

      {/* Large cyan and teal glows with animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow"
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slower"
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.3)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse"
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        <div className="absolute top-1/3 right-1/3 w-[700px] h-[700px] rounded-full blur-[140px] animate-pulse-slow"
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.25)' }} />
      </div>

      <Card className={`w-full max-w-md backdrop-blur-sm border-white/20 shadow-2xl ${isDark ? 'bg-[#1F1F20]/95' : 'bg-white/95'}`}>
        <CardHeader>
          <CardTitle className="text-2xl">
            {isForgotPassword ? "Mot de passe oublié" : isLogin ? "Connexion" : "Inscription"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Entrez votre email pour recevoir un lien de réinitialisation"
              : isLogin
              ? "Connectez-vous pour enregistrer vos sites web"
              : "Créez un compte pour commencer"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Forgot Password Form */}
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={forgotLoading}
                  />
                </div>
                <Button
                  type="submit"
                  variant="magellan"
                  className="w-full"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Envoyer le lien de réinitialisation
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline mx-auto"
                    disabled={forgotLoading}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Retour à la connexion
                  </button>
                </div>
              </form>
            ) : (
            <>
            {/* OAuth Buttons */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="magellan"
                className="w-full"
                onClick={() => handleOAuthLogin('google')}
                disabled={isButtonDisabled}
              >
                {oauthLoading === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {oauthLoading === 'google' ? 'Connexion...' : 'Continuer avec Google'}
              </Button>

              <Button
                type="button"
                variant="magellan"
                className="w-full"
                onClick={() => handleOAuthLogin('apple')}
                disabled={isButtonDisabled}
              >
                {oauthLoading === 'apple' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                )}
                {oauthLoading === 'apple' ? 'Connexion...' : 'Continuer avec Apple'}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className={`px-2 text-muted-foreground ${isDark ? 'bg-[#1F1F20]' : 'bg-white'}`}>
                  Ou continuer avec
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isButtonDisabled}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setForgotEmail(email); }}
                      className="text-xs text-primary hover:underline"
                      disabled={isButtonDisabled}
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isButtonDisabled}
                />
              </div>
              <Button
                type="submit"
                variant="magellan"
                className="w-full"
                disabled={isButtonDisabled}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isLogin ? "Connexion..." : "Inscription..."}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    {isLogin ? "Se connecter" : "S'inscrire"}
                  </>
                )}
              </Button>
            </form>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                disabled={isButtonDisabled}
              >
                {isLogin
                  ? "Pas encore de compte ? S'inscrire"
                  : "Déjà un compte ? Se connecter"}
              </button>
            </div>
            </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
