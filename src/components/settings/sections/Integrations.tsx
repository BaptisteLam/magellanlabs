import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Github, Figma } from 'lucide-react';

const integrations = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Base de données PostgreSQL pour vos projets IA',
    icon: Database,
    color: '#3ECF8E',
    connected: false,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Synchronisez et versionnez votre code',
    icon: Github,
    color: '#333',
    connected: false,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Importez vos designs en code',
    icon: Figma,
    color: '#F24E1E',
    connected: false,
  },
];

export function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Intégrations</h2>
        <p className="text-muted-foreground">Connectez vos outils préférés</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${integration.color}20` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: integration.color }} />
                    </div>
                    <div>
                      <CardTitle>{integration.name}</CardTitle>
                      <CardDescription className="mt-1">{integration.description}</CardDescription>
                    </div>
                  </div>
                  {integration.connected && <Badge variant="secondary">Connecté</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant={integration.connected ? 'outline' : 'default'}
                  className={
                    !integration.connected
                      ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 w-full'
                      : 'w-full'
                  }
                >
                  {integration.connected ? 'Déconnecter' : 'Connecter'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
