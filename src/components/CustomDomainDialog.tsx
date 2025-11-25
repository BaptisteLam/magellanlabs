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
  const [step, setStep] = useState<1 | 2>(1);
  const [cnameTarget, setCnameTarget] = useState('');

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
        // Cloudflare Pages URL format: projectname.pages.dev
        setCnameTarget(`${cloudflareProjectName}.pages.dev`);
        setStep(2);
        toast.success('Domaine ajouté à Cloudflare !');
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

  const handleClose = () => {
    setStep(1);
    setCustomDomain('');
    setCnameTarget('');
    onOpenChange(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#1f1f20] border-[#3a3a3b]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {step === 1 ? 'Domaine Personnalisé' : 'Configuration DNS'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 1 ? (
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
              className="w-full border rounded-full px-4 py-0"
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
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="p-4 bg-[#181818] rounded-lg border border-[#3a3a3b]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium text-foreground">{customDomain}</div>
                  <div className="text-xs text-muted-foreground px-2 py-1 bg-[#1f1f20] rounded">
                    Inactif (nécessite une configuration DNS)
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Terminer la configuration DNS</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">1. Connectez-vous à votre fournisseur DNS</p>
                    <p className="text-xs text-muted-foreground mb-3">Ajoutez l'enregistrement CNAME suivant :</p>
                    
                    <div className="space-y-2">
                      <div className="bg-[#181818] p-3 rounded border border-[#3a3a3b]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Nom</span>
                          <button
                            onClick={() => copyToClipboard(customDomain)}
                            className="text-xs hover:underline"
                            style={{ color: 'rgb(3,165,192)' }}
                          >
                            Cliquez pour copier
                          </button>
                        </div>
                        <div className="text-sm text-foreground font-mono">{customDomain}</div>
                      </div>

                      <div className="bg-[#181818] p-3 rounded border border-[#3a3a3b]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Cible</span>
                          <button
                            onClick={() => copyToClipboard(cnameTarget)}
                            className="text-xs hover:underline"
                            style={{ color: 'rgb(3,165,192)' }}
                          >
                            Cliquez pour copier
                          </button>
                        </div>
                        <div className="text-sm text-foreground font-mono">{cnameTarget}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">2. Enregistrez vos modifications</p>
                    <p className="text-xs text-muted-foreground">
                      Une fois les enregistrements ajoutés, vérifiez les enregistrements DNS pour initier la vérification.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#181818] rounded border border-[#3a3a3b]">
                  <p className="text-xs text-muted-foreground">
                    <strong>{customDomain}</strong> sera automatiquement activé si vos enregistrements sont correctement configurés. 
                    Les modifications DNS auprès de votre fournisseur peuvent prendre jusqu'à 24 heures pour être mises à jour globalement.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="w-full border rounded-full px-4 py-0"
                style={{
                  borderColor: 'rgb(3,165,192)',
                  backgroundColor: 'rgba(3,165,192,0.1)',
                  color: 'rgb(3,165,192)'
                }}
              >
                Terminer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
