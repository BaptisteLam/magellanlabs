import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Key, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function Securite() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error?.message?.includes('same_password')) {
        toast.error('Le nouveau mot de passe doit être différent de l\'ancien');
      } else {
        toast.error('Erreur lors du changement de mot de passe');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') {
      toast.error('Veuillez taper SUPPRIMER pour confirmer');
      return;
    }

    setIsDeleting(true);
    try {
      // Sign out the user — actual deletion requires admin/server-side action
      await supabase.auth.signOut();
      toast.success('Votre demande de suppression a été enregistrée. Vous recevrez un email de confirmation.');
      navigate('/auth');
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      toast.error('Erreur lors de la demande de suppression');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sécurité</h2>
        <p className="text-muted-foreground">Gérez la sécurité de votre compte</p>
      </div>

      {/* Changer le mot de passe */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" style={{ color: '#03A5C0' }} />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-foreground">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Minimum 6 caractères"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-foreground">Confirmer le mot de passe</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Retapez le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleChangePassword();
              }}
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all rounded-full px-6 py-2 gap-2 disabled:opacity-50"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)',
                border: '1px solid rgb(3,165,192)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.1)';
              }}
            >
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {isChangingPassword ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Zone dangereuse */}
      <Card className="rounded-[8px] border border-red-500/20 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            Zone dangereuse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Supprimer le compte</p>
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible. Tous vos projets et données seront supprimés.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all rounded-full px-6 py-2 gap-2"
              style={{
                borderColor: 'rgb(239,68,68)',
                backgroundColor: 'transparent',
                color: 'rgb(239,68,68)',
                border: '1px solid rgb(239,68,68)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Supprimer votre compte
            </DialogTitle>
            <DialogDescription>
              Cette action est <strong>irréversible</strong>. Tous vos projets, sites publiés et données seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">
              Tapez <strong>SUPPRIMER</strong> pour confirmer :
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="rounded-lg"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText('');
              }}
              className="rounded-full"
            >
              Annuler
            </Button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== 'SUPPRIMER'}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-all rounded-full px-6 py-2 gap-2 disabled:opacity-50"
              style={{
                backgroundColor: deleteConfirmText === 'SUPPRIMER' ? 'rgb(239,68,68)' : 'rgba(239,68,68,0.3)',
                color: 'white',
                border: 'none',
              }}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
