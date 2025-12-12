import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Megaphone, Share2, Mail, Save, Loader2 } from 'lucide-react';
import { useProjectData } from '@/hooks/useProjectData';
import { toast } from 'sonner';

export function Marketing() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: marketing, isLoading, upsert } = useProjectData(projectId, 'marketing');
  
  const [socialLinks, setSocialLinks] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: ''
  });
  const [emailSettings, setEmailSettings] = useState({
    newsletter_enabled: false,
    sender_email: '',
    sender_name: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (marketing) {
      setSocialLinks({
        facebook: marketing.social_links?.facebook || '',
        twitter: marketing.social_links?.twitter || '',
        instagram: marketing.social_links?.instagram || '',
        linkedin: marketing.social_links?.linkedin || '',
        youtube: marketing.social_links?.youtube || ''
      });
      setEmailSettings({
        newsletter_enabled: marketing.email_settings?.newsletter_enabled || false,
        sender_email: marketing.email_settings?.sender_email || '',
        sender_name: marketing.email_settings?.sender_name || ''
      });
    }
  }, [marketing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsert({
        social_links: socialLinks,
        email_settings: emailSettings
      });
      toast.success('Configuration marketing sauvegardée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour gérer le marketing</p>
        </div>
        <Card className="rounded-[8px]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun projet sélectionné
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
          <p className="text-muted-foreground">Gérez votre présence en ligne et vos campagnes</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
          variant="outline"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Social Links */}
          <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Réseaux sociaux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    placeholder="https://facebook.com/votrepage"
                    value={socialLinks.facebook}
                    onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter / X</Label>
                  <Input
                    id="twitter"
                    placeholder="https://twitter.com/votrepage"
                    value={socialLinks.twitter}
                    onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    placeholder="https://instagram.com/votrepage"
                    value={socialLinks.instagram}
                    onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    placeholder="https://linkedin.com/company/votrepage"
                    value={socialLinks.linkedin}
                    onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    placeholder="https://youtube.com/@votrechaine"
                    value={socialLinks.youtube}
                    onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sender_name">Nom de l'expéditeur</Label>
                  <Input
                    id="sender_name"
                    placeholder="Votre entreprise"
                    value={emailSettings.sender_name}
                    onChange={(e) => setEmailSettings({ ...emailSettings, sender_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender_email">Email de l'expéditeur</Label>
                  <Input
                    id="sender_email"
                    type="email"
                    placeholder="contact@votresite.com"
                    value={emailSettings.sender_email}
                    onChange={(e) => setEmailSettings({ ...emailSettings, sender_email: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns */}
          <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Campagnes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune campagne marketing pour le moment</p>
                <p className="text-sm mt-2">Les campagnes marketing seront bientôt disponibles</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
