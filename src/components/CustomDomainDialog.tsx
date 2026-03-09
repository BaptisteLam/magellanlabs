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
      toast.error('Please enter a domain name');
      return;
    }

    if (!sessionId || !cloudflareProjectName) {
      toast.error('Missing project information');
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
        toast.success('Domain added to Cloudflare!');
      } else {
        toast.error(data?.message || 'Error configuring the domain');
      }
    } catch (error) {
      console.error('Error adding custom domain:', error);
      toast.error('Error configuring the domain');
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
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#1f1f20] border-[#3a3a3b]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {step === 1 ? 'Custom Domain' : 'DNS Configuration'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 1 ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain" className="text-sm font-medium text-foreground">
                Domain name
              </Label>
              <Input
                id="domain"
                type="text"
                placeholder="example.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="bg-[#181818] border-[#3a3a3b] text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Cloudflare will automatically search for common DNS records and import them for you.
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
                  Analyzing...
                </>
              ) : (
                'Add domain'
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
                    Inactive (requires DNS configuration)
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Complete DNS configuration</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">1. Log in to your DNS provider</p>
                    <p className="text-xs text-muted-foreground mb-3">Add the following CNAME record:</p>
                    
                    <div className="space-y-2">
                      <div className="bg-[#181818] p-3 rounded border border-[#3a3a3b]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Name</span>
                          <button
                            onClick={() => copyToClipboard(customDomain)}
                            className="text-xs hover:underline"
                            style={{ color: 'rgb(3,165,192)' }}
                          >
                            Click to copy
                          </button>
                        </div>
                        <div className="text-sm text-foreground font-mono">{customDomain}</div>
                      </div>

                      <div className="bg-[#181818] p-3 rounded border border-[#3a3a3b]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Target</span>
                          <button
                            onClick={() => copyToClipboard(cnameTarget)}
                            className="text-xs hover:underline"
                            style={{ color: 'rgb(3,165,192)' }}
                          >
                            Click to copy
                          </button>
                        </div>
                        <div className="text-sm text-foreground font-mono">{cnameTarget}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">2. Save your changes</p>
                    <p className="text-xs text-muted-foreground">
                      Once the records are added, verify the DNS records to initiate verification.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#181818] rounded border border-[#3a3a3b]">
                  <p className="text-xs text-muted-foreground">
                    <strong>{customDomain}</strong> will be automatically activated if your records are correctly configured.
                    DNS changes at your provider may take up to 24 hours to propagate globally.
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
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
