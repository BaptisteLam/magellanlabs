import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThemeStore } from '@/stores/themeStore';
import { Settings, Moon, Sun, Monitor } from 'lucide-react';

export function Parametres() {
  const { isDark, toggleTheme } = useThemeStore();
  const [themeMode, setThemeMode] = useState(isDark ? 'dark' : 'light');
  const [language, setLanguage] = useState('fr');
  const [autoSave, setAutoSave] = useState(true);

  const handleThemeChange = (mode: string) => {
    setThemeMode(mode as 'light' | 'dark');
    if ((mode === 'dark' && !isDark) || (mode === 'light' && isDark)) {
      toggleTheme();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Paramètres</h2>
        <p className="text-muted-foreground">Configurez vos préférences générales</p>
      </div>

      <Card className="rounded-[8px]">
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

      <Card className="rounded-[8px]">
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

      <Card className="rounded-[8px]">
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
    </div>
  );
}
