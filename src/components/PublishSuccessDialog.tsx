import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Globe, Copy, Server } from 'lucide-react';
import { useState } from 'react';
import { CustomDomainDialog } from './CustomDomainDialog';
import { toast as sonnerToast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useCredits } from '@/hooks/useCredits';

interface PublishSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicUrl: string;
  cloudflareUrl?: string;
  projectName: string;
  sessionId?: string;
  cloudflareProjectName?: string;
}

export function PublishSuccessDialog({
  open,
  onOpenChange,
  publicUrl,
  cloudflareUrl,
  projectName,
  sessionId,
  cloudflareProjectName
}: PublishSuccessDialogProps) {
  const [showDomainDialog, setShowDomainDialog] = useState(false);
  const [showTechnicalUrl, setShowTechnicalUrl] = useState(false);
  const { language } = useTranslation();
  const isFr = language === 'fr';
  const { canAddDomain } = useCredits();

  const handleOpenSite = () => {
    window.open(publicUrl, '_blank');
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      sonnerToast.success(isFr ? 'URL copiée !' : 'URL copied!');
    } catch {
      sonnerToast.error(isFr ? 'Erreur lors de la copie' : 'Error copying URL');
    }
  };

  const handleAddDomain = () => {
    setShowDomainDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] bg-[#1f1f20] border-[#3a3a3b]">
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            <div className="rounded-full p-4" style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}>
              <CheckCircle2
                className="w-16 h-16"
                style={{ color: 'rgb(3,165,192)' }}
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {isFr ? 'Site publié avec succès !' : 'Site published successfully!'}
              </h2>
              <p className="text-muted-foreground">
                {isFr ? 'Votre projet est maintenant en ligne et accessible au public' : 'Your project is now live and publicly accessible'}
              </p>
            </div>

            <div className="w-full space-y-3">
              <div className="flex items-center justify-between gap-2 p-4 bg-[#181818] rounded-lg border border-[#3a3a3b]">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-mono text-foreground truncate">
                    {publicUrl.replace('https://', '')}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              {cloudflareUrl && cloudflareUrl !== publicUrl && (
                <div className="w-full">
                  <button
                    onClick={() => setShowTechnicalUrl(!showTechnicalUrl)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Server className="w-3 h-3" />
                    {showTechnicalUrl
                      ? (isFr ? "Masquer l'URL technique" : 'Hide technical URL')
                      : (isFr ? "Voir l'URL technique" : 'View technical URL')
                    }
                  </button>

                  {showTechnicalUrl && (
                    <div className="mt-2 flex items-center gap-2 p-3 bg-[#141414] rounded-lg border border-[#2a2a2b]">
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {cloudflareUrl.replace('https://', '')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(cloudflareUrl);
                          sonnerToast.success(isFr ? 'URL technique copiée !' : 'Technical URL copied!');
                        }}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleOpenSite}
                className="w-full inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-sm gap-2 transition-all border rounded-full px-4 py-0 h-10"
                style={{
                  borderColor: 'rgb(3,165,192)',
                  backgroundColor: 'rgba(3,165,192,0.1)',
                  color: 'rgb(3,165,192)'
                }}
              >
                <ExternalLink className="w-4 h-4" />
                {isFr ? 'Voir le site' : 'View site'}
              </Button>

              {canAddDomain && (
                <Button
                  onClick={handleAddDomain}
                  variant="outline"
                  className="w-full rounded-full h-10 border-[#3a3a3b] text-foreground hover:bg-[#181818]"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  {isFr ? 'Ajouter un nom de domaine' : 'Add a custom domain'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CustomDomainDialog
        open={showDomainDialog}
        onOpenChange={setShowDomainDialog}
        sessionId={sessionId}
        cloudflareProjectName={cloudflareProjectName}
      />
    </>
  );
}
