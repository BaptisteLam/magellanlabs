import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CustomDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  cloudflareProjectName?: string;
}

export function CustomDomainDialog({ 
  open, 
  onOpenChange, 
  sessionId,
  cloudflareProjectName 
}: CustomDomainDialogProps) {
  const [customDomain, setCustomDomain] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAddDomain = async () => {
    if (!customDomain.trim()) {
      toast.error('Veuillez entrer un nom de domaine');
      return;
    }

    if (!sessionId || !cloudflareProjectName) {
      toast.error('Informations de projet manquantes');
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('add-custom-domain', {
        body: {
          domain: customDomain,
          projectName: cloudflareProjectName,
          sessionId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Domaine personnalisé configuré avec succès !');
        setCustomDomain('');
        onOpenChange(false);
      } else {
        toast.error(data?.message || 'Erreur lors de la configuration du domaine');
      }
    } catch (error) {
      console.error('Error adding custom domain:', error);
      toast.error('Erreur lors de la configuration du domaine');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#1f1f20] border-[#3a3a3b]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Domaine Personnalisé
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="domain" className="text-sm font-medium text-foreground">
              Nom de domaine
            </Label>
            <Input
              id="domain"
              type="text"
              placeholder="exemple.com"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="bg-[#181818] border-[#3a3a3b] text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Cloudflare recherchera automatiquement les enregistrements DNS courants et les importera pour vous.
            </p>
          </div>

          <Button
            onClick={handleAddDomain}
            disabled={isAnalyzing || !customDomain.trim()}
            className="w-full"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)'
            }}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              'Ajouter le domaine'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
