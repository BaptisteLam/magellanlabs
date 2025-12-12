import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Image } from 'lucide-react';
import { MarketingPromptBar } from '../MarketingPromptBar';
import { toast } from 'sonner';

export function Marketing() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  const handleCardClick = (prompt: string) => {
    toast.info(`Idée sélectionnée : ${prompt}`);
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour gérer le marketing</p>
        </div>
        <Card className="rounded-[8px] border border-border/50 bg-background/50 shadow-sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun projet sélectionné
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
        <p className="text-muted-foreground">Créez vos visuels et campagnes avec l'IA</p>
      </div>

      {/* Cartes d'idées de campagne */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card 
          onClick={() => handleCardClick('Création d\'un logo')}
          className="aspect-square rounded-xl border border-border/50 bg-background/50 shadow-sm cursor-pointer transition-all hover:border-[#03A5C0]/50 hover:shadow-md group"
        >
          <CardContent className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-[#03A5C0]/10 flex items-center justify-center mb-4 group-hover:bg-[#03A5C0]/20 transition-colors">
              <Palette className="h-8 w-8 text-[#03A5C0]" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Création d'un logo</h3>
            <p className="text-sm text-muted-foreground">
              Générez un logo unique et professionnel pour votre marque
            </p>
          </CardContent>
        </Card>

        <Card 
          onClick={() => handleCardClick('Lancement d\'une campagne sur un visuel')}
          className="aspect-square rounded-xl border border-border/50 bg-background/50 shadow-sm cursor-pointer transition-all hover:border-[#03A5C0]/50 hover:shadow-md group"
        >
          <CardContent className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-[#03A5C0]/10 flex items-center justify-center mb-4 group-hover:bg-[#03A5C0]/20 transition-colors">
              <Image className="h-8 w-8 text-[#03A5C0]" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Campagne visuelle</h3>
            <p className="text-sm text-muted-foreground">
              Lancez une campagne marketing avec des visuels percutants
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Prompt Bar */}
      <MarketingPromptBar 
        onSubmit={(prompt, files) => {
          console.log('Marketing prompt:', prompt, files);
          toast.info('Génération IA bientôt disponible');
        }}
      />
    </div>
  );
}
