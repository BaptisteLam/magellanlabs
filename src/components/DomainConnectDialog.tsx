import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, Copy, ExternalLink, AlertCircle, Sparkles, Lock, Globe, Clock, Mail } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface DomainConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  cloudflareProjectName?: string;
}

type Step = 'input' | 'discovering' | 'provider-choice' | 'automatic' | 'manual' | 'verifying' | 'success';

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
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const handleDiscover = async () => {
    if (!domain.trim()) {
      toast.error('Veuillez entrer un nom de domaine');
      return;
    }

    setStep('discovering');
    setDiscoveryProgress(0);

    // Animation du progress
    const progressInterval = setInterval(() => {
      setDiscoveryProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const { data, error } = await supabase.functions.invoke('domain-connect-discover', {
        body: { domain }
      });

      clearInterval(progressInterval);
      setDiscoveryProgress(100);

      if (error) throw error;

      if (data?.success) {
        setDiscoveryResult(data);

        // Petit délai pour l'animation
        setTimeout(() => {
          if (data.supported && data.method === 'automatic') {
            setStep('provider-choice');
          } else {
            setStep('manual');
          }
        }, 500);
      } else {
        toast.error(data?.message || 'Erreur lors de la découverte');
        setStep('input');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Error discovering provider:', error);
      toast.error('Erreur lors de la découverte du provider');
      setStep('input');
    }
  };

  const handleAutomaticConnect = () => {
    if (!discoveryResult?.connectUrl) return;

    setStep('automatic');

    // Ouvrir popup Domain Connect
    const popup = window.open(
      discoveryResult.connectUrl,
      'domain-connect',
      'width=750,height=750,scrollbars=yes,location=yes'
    );

    if (!popup) {
      toast.error('Popup bloquée. Veuillez autoriser les popups pour ce site.');
      setStep('provider-choice');
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
    startVerification();
  };

  const startVerification = async () => {
    setStep('verifying');
    setVerificationProgress(0);
    setVerificationAttempt(0);
    setElapsedTime(0);

    // Timer pour temps écoulé
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

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
          clearInterval(timeInterval);
          setStep('success');
          toast.success('🎉 Domaine connecté avec succès!');

          // Fermer après 3 secondes
          setTimeout(() => {
            handleClose();
            window.location.reload();
          }, 3000);

          return;
        }
      } catch (error) {
        console.error('Verification error:', error);
      }

      // Attendre avant le prochain essai
      if (attempt < maxAttempts - 1) {
        await sleep(pollInterval);
      }
    }

    // Timeout
    clearInterval(timeInterval);
    toast.error('Délai d\'attente dépassé. Veuillez vérifier votre configuration DNS.');
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
    setDiscoveryProgress(0);
    setVerificationProgress(0);
    setVerificationAttempt(0);
    setElapsedTime(0);
    onOpenChange(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTitle = () => {
    switch (step) {
      case 'input':
        return 'Connecter votre domaine';
      case 'discovering':
        return 'Détection en cours...';
      case 'provider-choice':
        return '✨ Bonne nouvelle !';
      case 'automatic':
        return 'Configuration automatique';
      case 'manual':
        return 'Configuration manuelle';
      case 'verifying':
        return 'Vérification DNS';
      case 'success':
        return '🎉 Félicitations !';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#1f1f20] border-[#3a3a3b]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {getTitle()}
          </DialogTitle>
          {step === 'input' && (
            <DialogDescription className="text-muted-foreground">
              Quel est votre nom de domaine ?
            </DialogDescription>
          )}
        </DialogHeader>

        {/* STEP 1: Input Domain */}
        {step === 'input' && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="exemple.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                className="bg-[#181818] border-[#3a3a3b] text-foreground text-lg h-12"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Entrez le nom de domaine que vous possédez déjà
              </p>
            </div>

            <Button
              onClick={handleDiscover}
              disabled={!domain.trim()}
              className="w-full h-12 text-lg rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgb(3,165,192) 0%, rgb(2,132,154) 100%)',
                color: 'white'
              }}
            >
              Continuer →
            </Button>

            <div className="pt-4 border-t border-[#3a3a3b] text-center">
              <p className="text-xs text-muted-foreground mb-2">
                💡 Pas encore de domaine ?
              </p>
              <a
                href="https://www.namecheap.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline"
                style={{ color: 'rgb(3,165,192)' }}
              >
                Acheter sur Namecheap →
              </a>
            </div>
          </div>
        )}

        {/* STEP 2: Discovering */}
        {step === 'discovering' && (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin" style={{ color: 'rgb(3,165,192)' }} />
                <Sparkles className="h-6 w-6 absolute top-0 right-0 animate-pulse" style={{ color: 'rgb(3,165,192)' }} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  ⚡ Analyse de votre domaine
                </p>
                <p className="text-sm text-muted-foreground">
                  Détection du fournisseur DNS...
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Progress value={discoveryProgress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {discoveryProgress}%
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Provider Choice (Automatic Available) */}
        {step === 'provider-choice' && discoveryResult && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Nous avons détecté que votre domaine est hébergé chez :
              </p>

              <div className="flex justify-center">
                <div className="p-6 bg-[#181818] rounded-xl border-2" style={{ borderColor: 'rgb(3,165,192)' }}>
                  <div className="text-center space-y-2">
                    <Globe className="h-12 w-12 mx-auto" style={{ color: 'rgb(3,165,192)' }} />
                    <p className="text-xl font-bold text-foreground">
                      {discoveryResult.provider?.displayName || discoveryResult.provider?.name}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground">
                Nous pouvons configurer automatiquement votre DNS !
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleAutomaticConnect}
                className="w-full h-14 text-lg rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgb(3,165,192) 0%, rgb(2,132,154) 100%)',
                  color: 'white'
                }}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Configuration Automatique
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">
                  Recommandé • 1 clic
                </span>
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">ou</p>
                <Button
                  onClick={() => setStep('manual')}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Configuration manuelle →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Automatic (Popup Opened) */}
        {step === 'automatic' && (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center space-y-4">
              <ExternalLink className="h-16 w-16" style={{ color: 'rgb(3,165,192)' }} />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  Fenêtre d'autorisation ouverte
                </p>
                <p className="text-sm text-muted-foreground">
                  Connectez-vous et autorisez la configuration DNS
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#181818] rounded-lg space-y-2">
              <p className="text-sm font-medium text-foreground">Étapes à suivre:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Connectez-vous à votre compte {discoveryResult?.provider?.name}</li>
                <li>Vérifiez les changements DNS proposés</li>
                <li>Cliquez sur "Autoriser" ou "Approuver"</li>
              </ol>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>La vérification démarrera automatiquement après autorisation</span>
            </div>
          </div>
        )}

        {/* STEP 5: Manual Configuration */}
        {step === 'manual' && discoveryResult?.instructions && (
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
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
              <h3 className="text-sm font-semibold text-foreground">Instructions:</h3>

              {discoveryResult.instructions.steps.map((stepItem, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {stepItem.title}
                  </p>
                  <p className="text-xs text-muted-foreground pl-4">{stepItem.description}</p>
                </div>
              ))}

              <div className="space-y-2 mt-6">
                <p className="text-sm font-semibold text-foreground">
                  Enregistrements DNS à ajouter:
                </p>

                {discoveryResult.instructions.records.map((record, index) => (
                  <div key={index} className="bg-[#181818] p-4 rounded-lg border border-[#3a3a3b]">
                    <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-muted-foreground block mb-1">Type:</span>
                        <div className="text-foreground font-mono font-bold">{record.type}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">Nom:</span>
                        <div className="text-foreground font-mono font-bold">{record.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">TTL:</span>
                        <div className="text-foreground font-mono">{record.ttl}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block mb-1">Valeur:</span>
                        <div className="text-sm text-foreground font-mono break-all bg-[#0a0a0a] p-2 rounded">
                          {record.value}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(record.value)}
                        className="flex-shrink-0"
                        title="Copier"
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
              className="w-full h-12 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgb(3,165,192) 0%, rgb(2,132,154) 100%)',
                color: 'white'
              }}
            >
              J'ai terminé la configuration
            </Button>
          </div>
        )}

        {/* STEP 6: Verifying DNS */}
        {step === 'verifying' && (
          <div className="space-y-6 py-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin" style={{ color: 'rgb(3,165,192)' }} />
                <Check className="h-6 w-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ color: 'rgb(3,165,192)' }} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  ⏳ Vérification DNS en cours...
                </p>
                <p className="text-sm text-muted-foreground">
                  Configuration appliquée avec succès !
                </p>
                <p className="text-xs text-muted-foreground">
                  Nous vérifions maintenant que les DNS sont bien propagés...
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Progress value={verificationProgress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tentative {verificationAttempt}/60</span>
                <span>⏱️ {formatTime(elapsedTime)}</span>
              </div>
            </div>

            <div className="p-4 bg-[#181818] rounded-lg space-y-2">
              <p className="text-xs font-medium text-foreground">⏱️ Temps estimé: 2-10 minutes</p>
              <p className="text-xs text-muted-foreground">
                La propagation DNS peut prendre quelques minutes. Patience...
              </p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200">
                  <p className="font-medium mb-1">💡 Conseil</p>
                  <p>
                    Vous pouvez fermer cette fenêtre. Nous vous enverrons un email dès que votre domaine sera actif !
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Success! */}
        {step === 'success' && (
          <div className="space-y-6 py-6">
            <div className="flex flex-col items-center space-y-4">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center animate-bounce"
                style={{ backgroundColor: 'rgba(3,165,192,0.2)' }}
              >
                <Check className="h-10 w-10" style={{ color: 'rgb(3,165,192)' }} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-foreground">
                  Votre site est maintenant en ligne !
                </p>
                <div className="flex items-center justify-center gap-2 text-lg" style={{ color: 'rgb(3,165,192)' }}>
                  <Globe className="h-5 w-5" />
                  <span className="font-mono font-semibold">https://{domain}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#181818] rounded-lg">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-foreground">Certificat SSL</span>
                </div>
                <span className="text-sm font-semibold text-green-500">✓ Activé</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#181818] rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" style={{ color: 'rgb(3,165,192)' }} />
                  <span className="text-sm text-foreground">DNS Propagation</span>
                </div>
                <span className="text-sm font-semibold text-green-500">✓ Complète</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => window.open(`https://${domain}`, '_blank')}
                className="flex-1 h-12 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgb(3,165,192) 0%, rgb(2,132,154) 100%)',
                  color: 'white'
                }}
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                Voir mon site
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 h-12 rounded-full border-[#3a3a3b]"
              >
                Tableau de bord
              </Button>
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <p className="text-xs text-green-200">
                📧 Email de confirmation envoyé
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
