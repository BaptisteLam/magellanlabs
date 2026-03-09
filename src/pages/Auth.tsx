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
    // Check Supabase configuration on startup
    const checkSupabaseConfig = async () => {
      try {
        // Simple test to verify that Supabase is reachable
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('❌ Supabase connection error:', error);
          if (error.message?.includes('Invalid API key') || error.message?.includes('Invalid URL')) {
            toast.error('Invalid Supabase configuration. Check your environment variables.');
          }
        } else {
          console.log('✅ Supabase connection OK');
        }
      } catch (e) {
        console.error('❌ Supabase unreachable:', e);
        toast.error('Unable to connect to Supabase. Check your connection.');
      }
    };

    checkSupabaseConfig();

    // Handle OAuth errors in the URL (e.g., error=access_denied)
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('OAuth error:', error, errorDescription);
      toast.error(errorDescription || `Authentication error: ${error}`);
      // Clean the URL
      window.history.replaceState({}, '', '/auth');
    }

    // Check if the user is already logged in
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        return;
      }

      if (session) {
        console.log('✅ User already logged in:', session.user.email);
        // Make sure the profile exists before redirecting
        await ensureUserProfile(session.user);
        handleRedirectAfterAuth();
      }
    };

    checkSession();

    // Listen for authentication state changes (important for OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);

      if (event === 'SIGNED_IN' && session) {
        // Make sure the user profile exists (fallback if the DB trigger fails)
        await ensureUserProfile(session.user);
        toast.success(`Welcome ${session.user.email}!`);
        handleRedirectAfterAuth();
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  // Check and create the user profile if needed (fallback if the DB trigger fails)
  const ensureUserProfile = async (user: { id: string; email?: string }) => {
    try {
      // Check if the profile exists
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Error checking profile:', fetchError);
        return;
      }

      // If the profile doesn't exist, create it
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
      // Build the redirect URL - use /auth to capture the callback
      const redirectUrl = `${window.location.origin}/auth`;

      console.log(`🚀 Starting ${provider} OAuth flow...`);
      console.log('📍 Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          // For Apple, add the required scopes
          ...(provider === 'apple' && {
            scopes: 'email name',
          }),
          // For Google, request the full profile
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
        // The redirect is handled automatically by Supabase
      }
    } catch (error: any) {
      console.error('OAuth error:', error);

      // Custom error messages
      let errorMessage = error.message || "An error occurred";

      if (error.message?.includes('provider is not enabled')) {
        errorMessage = `${provider === 'google' ? 'Google' : 'Apple'} authentication is not yet configured. Contact the administrator.`;
      } else if (error.message?.includes('redirect_uri_mismatch')) {
        errorMessage = "Configuration error. The redirect URL is not authorized.";
      }

      toast.error(errorMessage);
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("A password reset link has been sent to your email address. Check your inbox.");
      setIsForgotPassword(false);
    } catch (error: any) {
      console.error('❌ Forgot password error:', error);
      toast.error(error.message?.includes('rate limit') ? "Too many attempts. Please try again in a few minutes." : "Error sending the email. Please check the address you entered.");
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
        toast.success("Successfully logged in!");
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

        // Check if the user already has a session (email confirmation disabled)
        if (data.session) {
          toast.success("Account created successfully! You are now logged in.");
        } else if (data.user && !data.user.email_confirmed_at) {
          toast.success("Account created! Check your inbox to confirm your registration.");
        } else {
          toast.success("Account created!");
        }
      }
    } catch (error: any) {
      console.error('❌ Auth error:', error);

      // Custom error messages
      let errorMessage = error.message;

      // Login errors
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = "Incorrect email or password";
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = "Please confirm your email before logging in";
      }
      // Signup errors
      else if (error.message?.includes('User already registered')) {
        errorMessage = "An account already exists with this email";
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = "Password must contain at least 6 characters";
      } else if (error.message?.includes('Unable to validate email address')) {
        errorMessage = "Invalid email address";
      } else if (error.message?.includes('Signups not allowed')) {
        errorMessage = "Signups are disabled. Contact the administrator.";
      } else if (error.message?.includes('Email rate limit exceeded')) {
        errorMessage = "Too many attempts. Please try again later.";
      } else if (error.message?.includes('Database error')) {
        errorMessage = "Database error. Please try again.";
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = "Server connection error. Check your internet connection.";
      } else if (error.message?.includes('AuthApiError')) {
        errorMessage = "Authentication error. Please try again.";
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
      {/* Grid background - adapted to theme */}
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
            {isForgotPassword ? "Forgot password" : isLogin ? "Login" : "Sign up"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Enter your email to receive a reset link"
              : isLogin
              ? "Log in to save your websites"
              : "Create an account to get started"}
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
                    placeholder="your@email.com"
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
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Send reset link
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
                    Back to login
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
                {oauthLoading === 'google' ? 'Logging in...' : 'Continue with Google'}
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
                {oauthLoading === 'apple' ? 'Logging in...' : 'Continue with Apple'}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className={`px-2 text-muted-foreground ${isDark ? 'bg-[#1F1F20]' : 'bg-white'}`}>
                  Or continue with
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
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isButtonDisabled}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setForgotEmail(email); }}
                      className="text-xs text-primary hover:underline"
                      disabled={isButtonDisabled}
                    >
                      Forgot password?
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
                    {isLogin ? "Logging in..." : "Signing up..."}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    {isLogin ? "Log in" : "Sign up"}
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
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Log in"}
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
