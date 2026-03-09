import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, Copy, ExternalLink, AlertCircle, Sparkles, Lock, Globe, Clock, Mail, Zap, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { DOMAIN_CONNECT_PROVIDERS, NON_DOMAIN_CONNECT_PROVIDERS } from '@/lib/domain-connect/discovery.service';

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
  isDomainConnectProvider?: boolean;
  templateNotYetSupported?: boolean;
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
      description?: string;
    }>;
    notes?: string[];
  };
}

// Logos of supported Domain Connect providers
const PROVIDER_LOGOS: Record<string, string> = {
  'GoDaddy': 'https://img1.wsimg.com/cdn/Image/All/Logos/1/en-US/8f087ce7-2ff0-4e3f-9199-4d42afd4bc78/GoDaddy-Mascot-Full-Color-Dark-Bkgnd-RGB.png',
  '1&1 IONOS': 'https://www.ionos.com/favicon.ico',
  'Plesk': 'https://www.plesk.com/wp-content/uploads/2019/01/plesk-logo.png',
  'United Domains': 'https://www.united-domains.de/favicon.ico',
};

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
      toast.error('Please enter a domain name');
      return;
    }

    setStep('discovering');
    setDiscoveryProgress(0);

    // Progress animation
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

        // Short delay for animation
        setTimeout(() => {
          if (data.supported && data.method === 'automatic') {
            setStep('provider-choice');
          } else {
            setStep('manual');
          }
        }, 500);
      } else {
        toast.error(data?.message || 'Error during discovery');
        setStep('input');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Error discovering provider:', error);
      toast.error('Error discovering the provider');
      setStep('input');
    }
  };

  const handleAutomaticConnect = () => {
    if (!discoveryResult?.connectUrl) return;

    setStep('automatic');

    // Open Domain Connect popup
    const popup = window.open(
      discoveryResult.connectUrl,
      'domain-connect',
      'width=750,height=750,scrollbars=yes,location=yes'
    );

    if (!popup) {
      toast.error('Popup blocked. Please allow popups for this site.');
      setStep('provider-choice');
      return;
    }

    // Monitor popup closure
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        // Start DNS verification
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

    // Timer for elapsed time
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    const maxAttempts = 60; // 10 minutes
    const pollInterval = 10000; // 10 seconds

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
          toast.success('Domain connected successfully!');

          // Close after 3 seconds
          setTimeout(() => {
            handleClose();
            window.location.reload();
          }, 3000);

          return;
        }
      } catch (error) {
        console.error('Verification error:', error);
      }

      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        await sleep(pollInterval);
      }
    }

    // Timeout
    clearInterval(timeInterval);
    toast.error('Timeout exceeded. Please check your DNS configuration.');
    setStep('manual');
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
        return 'Connect your domain';
      case 'discovering':
        return 'Detecting...';
      case 'provider-choice':
        return 'Great news!';
      case 'automatic':
        return 'Automatic configuration';
      case 'manual':
        return 'Manual configuration';
      case 'verifying':
        return 'DNS Verification';
      case 'success':
        return 'Congratulations!';
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
              What is your domain name?
            </DialogDescription>
          )}
        </DialogHeader>

        {/* STEP 1: Input Domain */}
        {step === 'input' && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                className="bg-[#181818] border-[#3a3a3b] text-foreground text-lg h-12"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain name you already own
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
              Continue →
            </Button>

            <div className="pt-4 border-t border-[#3a3a3b] text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Don't have a domain yet?
              </p>
              <a
                href="https://www.namecheap.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline"
                style={{ color: 'rgb(3,165,192)' }}
              >
                Buy on Namecheap →
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
                  Analyzing your domain
                </p>
                <p className="text-sm text-muted-foreground">
                  Detecting DNS provider...
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
                We detected that your domain is hosted at:
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
                We can automatically configure your DNS!
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
                Automatic Setup
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">
                  Recommended • 1 click
                </span>
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">or</p>
                <Button
                  onClick={() => setStep('manual')}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Manual setup →
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
                  Authorization window opened
                </p>
                <p className="text-sm text-muted-foreground">
                  Sign in and authorize the DNS configuration
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#181818] rounded-lg space-y-2">
              <p className="text-sm font-medium text-foreground">Steps to follow:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Sign in to your {discoveryResult?.provider?.name} account</li>
                <li>Review the proposed DNS changes</li>
                <li>Click "Authorize" or "Approve"</li>
              </ol>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Verification will start automatically after authorization</span>
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
                  Manual configuration required
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Provider: {discoveryResult.instructions.provider}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Instructions</h3>

              {discoveryResult.instructions.steps.map((stepItem, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {stepItem.title}
                  </p>
                  <p className="text-xs text-muted-foreground pl-4">{stepItem.description}</p>
                </div>
              ))}

              <div className="space-y-3 mt-6">
                <p className="text-sm font-semibold text-foreground">
                  DNS records to add:
                </p>

                {discoveryResult.instructions.records.map((record, index) => (
                  <div key={index} className="bg-[#181818] p-4 rounded-lg border border-[#3a3a3b]">
                    {record.description && (
                      <p className="text-xs text-muted-foreground mb-3 italic">
                        {record.description}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-muted-foreground block mb-1">Type</span>
                        <div 
                          className="font-mono font-bold px-2 py-1 rounded inline-block"
                          style={{ 
                            backgroundColor: record.type === 'A' ? 'rgba(34,197,94,0.2)' : 'rgba(3,165,192,0.2)',
                            color: record.type === 'A' ? 'rgb(34,197,94)' : 'rgb(3,165,192)'
                          }}
                        >
                          {record.type}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">Name</span>
                        <div className="text-foreground font-mono font-bold">{record.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">TTL</span>
                        <div className="text-foreground font-mono">{record.ttl}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block mb-1">Value</span>
                        <div className="text-sm text-foreground font-mono break-all bg-[#0a0a0a] p-2 rounded">
                          {record.value}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(record.value)}
                        className="flex-shrink-0"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Notes explicatives */}
                {discoveryResult.instructions.notes && discoveryResult.instructions.notes.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs font-medium text-blue-300 mb-2">Important notes:</p>
                    <ul className="text-xs text-blue-200/80 space-y-1">
                      {discoveryResult.instructions.notes.map((note, idx) => (
                        <li key={idx}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
              I've completed the setup
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
                  DNS verification in progress...
                </p>
                <p className="text-sm text-muted-foreground">
                  Configuration applied successfully!
                </p>
                <p className="text-xs text-muted-foreground">
                  We are now verifying that the DNS has propagated...
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Progress value={verificationProgress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Attempt {verificationAttempt}/60</span>
                <span>⏱️ {formatTime(elapsedTime)}</span>
              </div>
            </div>

            <div className="p-4 bg-[#181818] rounded-lg space-y-2">
              <p className="text-xs font-medium text-foreground">Estimated time: 2-10 minutes</p>
              <p className="text-xs text-muted-foreground">
                DNS propagation may take a few minutes. Please be patient...
              </p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200">
                  <p className="font-medium mb-1">Tip</p>
                  <p>
                    You can close this window. We'll send you an email as soon as your domain is active!
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
                  Your site is now live!
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
                  <span className="text-sm text-foreground">SSL Certificate</span>
                </div>
                <span className="text-sm font-semibold text-green-500">✓ Active</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#181818] rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" style={{ color: 'rgb(3,165,192)' }} />
                  <span className="text-sm text-foreground">DNS Propagation</span>
                </div>
                <span className="text-sm font-semibold text-green-500">✓ Complete</span>
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
                View my site
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 h-12 rounded-full border-[#3a3a3b]"
              >
                Dashboard
              </Button>
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <p className="text-xs text-green-200">
                Confirmation email sent
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
