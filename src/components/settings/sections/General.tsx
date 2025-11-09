import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThemeStore } from '@/stores/themeStore';
import { Moon, Sun, Monitor, Bell, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export function General() {
  const { isDark, toggleTheme } = useThemeStore();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(isDark ? 'dark' : 'light');
  const [language, setLanguage] = useState('FR');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [aiUpdates, setAiUpdates] = useState(true);
  const [buildComplete, setBuildComplete] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  const handleThemeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    if (mode === 'system') {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if ((isDarkMode && !isDark) || (!isDarkMode && isDark)) {
        toggleTheme();
      }
    } else {
      const shouldBeDark = mode === 'dark';
      if (shouldBeDark !== isDark) {
        toggleTheme();
      }
    }
    toast({ title: `Thème changé : ${mode}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Général</h2>
        <p className="text-muted-foreground">Préférences utilisateur globales</p>
      </div>

      <Card className="rounded-[7px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Apparence
          </CardTitle>
          <CardDescription>Choisissez le thème de l'application</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={themeMode} onValueChange={(v) => handleThemeChange(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        </CardContent>
      </Card>

      <Card className="rounded-[7px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🌍 Langue
          </CardTitle>
          <CardDescription>Langue de l'interface</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EN">🇬🇧 English</SelectItem>
              <SelectItem value="FR">🇫🇷 Français</SelectItem>
              <SelectItem value="ES">🇪🇸 Español</SelectItem>
              <SelectItem value="PT">🇵🇹 Português</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-[7px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Gérez vos préférences de notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifs" className="cursor-pointer">
              Notifications par email
            </Label>
            <Switch id="email-notifs" checked={emailNotifs} onCheckedChange={setEmailNotifs} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-updates" className="cursor-pointer">
              Mises à jour IA
            </Label>
            <Switch id="ai-updates" checked={aiUpdates} onCheckedChange={setAiUpdates} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="build-complete" className="cursor-pointer">
              Build terminé
            </Label>
            <Switch id="build-complete" checked={buildComplete} onCheckedChange={setBuildComplete} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[7px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Sauvegarde automatique
          </CardTitle>
          <CardDescription>Enregistre automatiquement vos modifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-save" className="cursor-pointer">
              Activer la sauvegarde automatique
            </Label>
            <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
