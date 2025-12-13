import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, Copy, ExternalLink, AlertCircle } from 'lucide-react';

interface DomainConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  cloudflareProjectName?: string;
}

type Step = 'input' | 'discovering' | 'automatic' | 'manual' | 'verifying' | 'success';

interface DiscoveryResult {
  supported: boolean;
  method: 'automatic' | 'manual';
  provider?: {
    id: string;
    name: string;
    displayName: string;
  };
  connectUrl?: string;
  providerName?: string;
  instructions?: {
    provider: string;
    steps: Array<{
      title: string;
      description: string;
    }>;
    records: Array<{
      type: string;
      name: string;
      value: string;
      ttl: string;
    }>;
  };
}

export function DomainConnectDialog({
  open,
  onOpenChange,
  sessionId,
  cloudflareProjectName
}: DomainConnectDialogProps) {
  const [domain, setDomain] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  const handleDiscover = async () => {
    if (!domain.trim()) {
      toast.error('Veuillez entrer un nom de domaine');
      return;
    }

    setStep('discovering');

    try {
      const { data, error } = await supabase.functions.invoke('domain-connect-discover', {
        body: { domain }
      });

      if (error) throw error;

      if (data?.success) {
        setDiscoveryResult(data);

        if (data.supported && data.method === 'automatic') {
          setStep('automatic');
        } else {
          setStep('manual');
        }
      } else {
        toast.error(data?.message || 'Erreur lors de la découverte');
        setStep('input');
      }
    } catch (error) {
      console.error('Error discovering provider:', error);
      toast.error('Erreur lors de la découverte du provider');
      setStep('input');
    }
  };

  const handleAutomaticConnect = () => {
    if (!discoveryResult?.connectUrl) return;

    // Ouvrir popup Domain Connect
    const popup = window.open(
      discoveryResult.connectUrl,
      'domain-connect',
      'width=750,height=750,scrollbars=yes'
    );

    if (!popup) {
      toast.error('Popup bloquée. Veuillez autoriser les popups pour ce site.');
      return;
    }

    // Surveiller la fermeture de la popup
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        // Lancer la vérification DNS
        startVerification();
      }
    }, 1000);
  };

  const handleManualContinue = () => {
    // Lancer la vérification DNS après configuration manuelle
    startVerification();
  };

  const startVerification = async () => {
    setStep('verifying');
    setVerificationProgress(0);
    setVerificationAttempt(0);

    const maxAttempts = 60; // 10 minutes
    const pollInterval = 10000; // 10 secondes

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      setVerificationAttempt(attempt + 1);
      setVerificationProgress(Math.round(((attempt + 1) / maxAttempts) * 100));

      try {
        const { data, error } = await supabase.functions.invoke('domain-connect-verify', {
          body: { domain, sessionId }
        });

        if (error) throw error;

        if (data?.configured) {
          // Succès!
          setStep('success');
          toast.success('🎉 Domaine connecté avec succès!');

          // Fermer le dialog après 2 secondes
          setTimeout(() => {
            handleClose();
            // Recharger la page pour afficher le nouveau domaine
            window.location.reload();
          }, 2000);

          return;
        }
      } catch (error) {
        console.error('Verification error:', error);
      }

      // Attendre avant le prochain essai (sauf au dernier)
      if (attempt < maxAttempts - 1) {
        await sleep(pollInterval);
      }
    }

    // Timeout
    toast.error('Timeout: DNS non configuré après 10 minutes. Veuillez vérifier votre configuration.');
    setStep('manual');
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  const handleClose = () => {
    setStep('input');
    setDomain('');
    setDiscoveryResult(null);
    setVerificationProgress(0);
    setVerificationAttempt(0);
    onOpenChange(false);
  };

  const getTitle = () => {
    switch (step) {
      case 'input':
      case 'discovering':
        return 'Connecter un domaine personnalisé';
      case 'automatic':
        return 'Configuration automatique';
      case 'manual':
        return 'Configuration manuelle';
      case 'verifying':
        return 'Vérification DNS';
      case 'success':
        return 'Succès!';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#1f1f20] border-[#3a3a3b]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Input Domain */}
        {step === 'input' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain" className="text-sm font-medium text-foreground">
                Nom de domaine
              </Label>
              <Input
                id="domain"
                type="text"
                placeholder="monsite.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                className="bg-[#181818] border-[#3a3a3b] text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Nous détecterons automatiquement votre provider DNS et configurerons votre domaine.
              </p>
            </div>

            <Button
              onClick={handleDiscover}
              disabled={!domain.trim()}
              className="w-full border rounded-full px-4 py-0"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)'
              }}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Step 2: Discovering */}
        {step === 'discovering' && (
          <div className="space-y-6 py-8 flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'rgb(3,165,192)' }} />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Analyse de votre domaine...</p>
              <p className="text-xs text-muted-foreground">Détection du provider DNS en cours</p>
            </div>
          </div>
        )}

        {/* Step 3a: Automatic Configuration */}
        {step === 'automatic' && discoveryResult && (
          <div className="space-y-6 py-4">
            <div className="p-4 bg-[#181818] rounded-lg border border-[#3a3a3b]">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5" style={{ color: 'rgb(3,165,192)' }} />
                <div className="text-sm font-medium text-foreground">
                  Provider détecté: {discoveryResult.provider?.displayName || discoveryResult.provider?.name}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Configuration automatique disponible
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Nous pouvons configurer automatiquement votre domaine via {discoveryResult.provider?.name}.
              </p>
              <p className="text-xs text-muted-foreground">
                Une popup s'ouvrira pour vous demander l'autorisation. Une fois autorisé, votre DNS sera configuré automatiquement.
              </p>
            </div>

            <Button
              onClick={handleAutomaticConnect}
              className="w-full border rounded-full px-4 py-0"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)'
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Configuration automatique
            </Button>

            <Button
              onClick={() => setStep('manual')}
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Préférer la configuration manuelle
            </Button>
          </div>
        )}

        {/* Step 3b: Manual Configuration */}
        {step === 'manual' && discoveryResult?.instructions && (
          <div className="space-y-6 py-4">
            <div className="p-4 bg-[#181818] rounded-lg border border-[#3a3a3b]">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div className="text-sm font-medium text-foreground">
                  Configuration manuelle requise
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Provider: {discoveryResult.instructions.provider}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Instructions</h3>

              {discoveryResult.instructions.steps.map((stepItem, index) => (
                <div key={index}>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {index + 1}. {stepItem.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{stepItem.description}</p>
                </div>
              ))}

              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium text-foreground">Enregistrements DNS à ajouter:</p>

                {discoveryResult.instructions.records.map((record, index) => (
                  <div key={index} className="bg-[#181818] p-3 rounded border border-[#3a3a3b]">
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <div className="text-foreground font-mono">{record.type}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nom:</span>
                        <div className="text-foreground font-mono">{record.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">TTL:</span>
                        <div className="text-foreground font-mono">{record.ttl}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground">Valeur:</span>
                        <div className="text-sm text-foreground font-mono break-all">{record.value}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(record.value)}
                        className="ml-2"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleManualContinue}
              className="w-full border rounded-full px-4 py-0"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)'
              }}
            >
              J'ai terminé la configuration
            </Button>
          </div>
        )}

        {/* Step 4: Verifying */}
        {step === 'verifying' && (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'rgb(3,165,192)' }} />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground">Vérification DNS en cours...</p>
                <p className="text-xs text-muted-foreground">
                  {verificationProgress}% - Tentative {verificationAttempt}/60
                </p>
                <p className="text-xs text-muted-foreground">
                  Cela peut prendre quelques minutes
                </p>
              </div>
              <div className="w-full bg-[#181818] rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${verificationProgress}%`,
                    backgroundColor: 'rgb(3,165,192)'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && (
          <div className="space-y-6 py-8 flex flex-col items-center">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}
            >
              <Check className="h-8 w-8" style={{ color: 'rgb(3,165,192)' }} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Domaine connecté!</p>
              <p className="text-sm text-muted-foreground">
                Votre site est maintenant accessible sur <span className="text-foreground font-mono">{domain}</span>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
