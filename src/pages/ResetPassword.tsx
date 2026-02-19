import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { useThemeStore } from '@/stores/themeStore';
import Header from "@/components/layout/Header";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Écouter l'événement PASSWORD_RECOVERY envoyé par Supabase après clic sur le lien email
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsReady(true);
      }
    });

    // Vérifier si on a déjà une session (lien déjà cliqué)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Mot de passe mis à jour avec succès !");
      navigate('/dashboard');
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      if (error.message?.includes('New password should be different')) {
        toast.error("Le nouveau mot de passe doit être différent de l'ancien");
      } else {
        toast.error("Erreur lors de la mise à jour du mot de passe. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden pt-20">
        {/* Grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: isDark
              ? 'linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)'
              : 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            backgroundColor: isDark ? '#1F1F20' : '#ffffff',
          }}
        />

        {/* Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow"
               style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
          <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slower"
               style={{ backgroundColor: 'rgba(3, 165, 192, 0.3)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse"
               style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        </div>

        <Card className={`w-full max-w-md backdrop-blur-sm border-white/20 shadow-2xl ${isDark ? 'bg-[#1F1F20]/95' : 'bg-white/95'}`}>
          <CardHeader>
            <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
            <CardDescription>
              {isReady
                ? "Choisissez votre nouveau mot de passe"
                : "Chargement du lien de réinitialisation..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isReady ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#03A5C0' }} />
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Au moins 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Répétez votre mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  variant="magellan"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Mettre à jour le mot de passe
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
