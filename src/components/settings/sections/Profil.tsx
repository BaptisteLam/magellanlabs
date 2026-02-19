import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Camera, Save, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileData {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function Profil() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile({
          id: data.id,
          email: (data as any).email || session.user.email || '',
          display_name: (data as any).display_name || null,
          avatar_url: (data as any).avatar_url || null,
        });
        setDisplayName((data as any).display_name || '');
      } else {
        // Profile row may not exist yet — use auth data
        setProfile({
          id: session.user.id,
          email: session.user.email || '',
          display_name: null,
          avatar_url: null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Erreur lors du chargement du profil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, display_name: displayName.trim() || null } : null);
      toast.success('Profil mis à jour');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${profile.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('project-icons')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-icons')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast.success('Photo de profil mise à jour');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted/50 rounded animate-pulse w-40" />
        <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  const initials = (displayName || profile?.email || '?')
    .split(/[\s@]/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profil</h2>
        <p className="text-muted-foreground">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar Card */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Photo de profil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className={cn(
                  "relative w-20 h-20 rounded-full border-2 border-dashed border-border/50 overflow-hidden group transition-colors hover:border-[#03A5C0]",
                  isUploadingAvatar && "opacity-50 cursor-wait"
                )}
                title="Cliquez pour changer la photo"
              >
                {profile?.avatar_url ? (
                  <>
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  </>
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: 'rgba(3,165,192,0.8)' }}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      initials
                    )}
                  </div>
                )}
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {displayName || profile?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                Cliquez sur l'avatar pour changer la photo
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou GIF · max 2 Mo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-foreground">Adresse e-mail</Label>
            <Input
              value={profile?.email || ''}
              disabled
              className="rounded-lg bg-muted/30 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              L'adresse e-mail ne peut pas être modifiée ici
            </p>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="text-foreground">Nom affiché</Label>
            <Input
              id="display-name"
              placeholder="Votre nom complet"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveProfile();
              }}
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="rounded-full px-6 py-2 gap-2 border transition-all"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)'
              }}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
