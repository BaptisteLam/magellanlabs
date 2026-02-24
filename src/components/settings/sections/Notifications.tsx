import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Mail, MessageSquare, Globe, Megaphone } from 'lucide-react';

const STORAGE_KEY = 'magellan-notification-prefs';

interface NotificationPrefs {
  emailNewContact: boolean;
  emailSitePublished: boolean;
  emailWeeklyReport: boolean;
  emailProductUpdates: boolean;
}

const defaultPrefs: NotificationPrefs = {
  emailNewContact: true,
  emailSitePublished: true,
  emailWeeklyReport: false,
  emailProductUpdates: true,
};

export function Notifications() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
        <p className="text-muted-foreground">Choisissez les notifications que vous souhaitez recevoir</p>
      </div>

      {/* Notifications par email */}
      <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" style={{ color: '#03A5C0' }} />
            Notifications par email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* New contact */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}
              >
                <MessageSquare className="h-4 w-4" style={{ color: '#03A5C0' }} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-foreground font-medium">Nouveau contact</Label>
                <p className="text-xs text-muted-foreground">
                  Recevez un email quand un visiteur remplit le formulaire de contact
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.emailNewContact}
              onCheckedChange={(v) => updatePref('emailNewContact', v)}
            />
          </div>

          {/* Site published */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}
              >
                <Globe className="h-4 w-4" style={{ color: '#03A5C0' }} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-foreground font-medium">Publication de site</Label>
                <p className="text-xs text-muted-foreground">
                  Confirmation par email quand votre site est publié ou mis à jour
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.emailSitePublished}
              onCheckedChange={(v) => updatePref('emailSitePublished', v)}
            />
          </div>

          {/* Weekly report */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}
              >
                <Bell className="h-4 w-4" style={{ color: '#03A5C0' }} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-foreground font-medium">Rapport hebdomadaire</Label>
                <p className="text-xs text-muted-foreground">
                  Résumé des visites et contacts de la semaine
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.emailWeeklyReport}
              onCheckedChange={(v) => updatePref('emailWeeklyReport', v)}
            />
          </div>

          {/* Product updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}
              >
                <Megaphone className="h-4 w-4" style={{ color: '#03A5C0' }} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-foreground font-medium">Nouveautés produit</Label>
                <p className="text-xs text-muted-foreground">
                  Soyez informé des nouvelles fonctionnalités et mises à jour
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.emailProductUpdates}
              onCheckedChange={(v) => updatePref('emailProductUpdates', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
