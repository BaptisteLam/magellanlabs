import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';

export function SiteWeb() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Site Web</h2>
        <p className="text-muted-foreground">Gérez les paramètres de votre site web</p>
      </div>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configuration du site
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucune configuration pour le moment</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
