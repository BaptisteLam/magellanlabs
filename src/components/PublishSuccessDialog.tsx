import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Globe } from 'lucide-react';
import { useState } from 'react';
import { CustomDomainDialog } from './CustomDomainDialog';

interface PublishSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicUrl: string;
  projectName: string;
  sessionId?: string;
  cloudflareProjectName?: string;
}

export function PublishSuccessDialog({ 
  open, 
  onOpenChange,
  publicUrl,
  projectName,
  sessionId,
  cloudflareProjectName
}: PublishSuccessDialogProps) {
  const [showDomainDialog, setShowDomainDialog] = useState(false);

  const handleOpenSite = () => {
    window.open(publicUrl, '_blank');
  };

  const handleAddDomain = () => {
    setShowDomainDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] bg-[#1f1f20] border-[#3a3a3b]">
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            {/* Icône de validation */}
            <div className="rounded-full p-4" style={{ backgroundColor: 'rgba(3,165,192,0.1)' }}>
              <CheckCircle2 
                className="w-16 h-16" 
                style={{ color: 'rgb(3,165,192)' }}
              />
            </div>

            {/* Message de confirmation */}
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                Site publié avec succès !
              </h2>
              <p className="text-muted-foreground">
                Votre projet est maintenant en ligne et accessible au public
              </p>
            </div>

            {/* Lien du site */}
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center gap-2 p-4 bg-[#181818] rounded-lg border border-[#3a3a3b]">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-mono text-foreground">
                  {publicUrl.replace('https://', '')}
                </span>
              </div>

              {/* Bouton Voir le site */}
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
                Voir le site
              </Button>

              {/* Bouton Ajouter un domaine */}
              <Button
                onClick={handleAddDomain}
                variant="outline"
                className="w-full rounded-full h-10 border-[#3a3a3b] text-foreground hover:bg-[#181818]"
              >
                <Globe className="w-4 h-4 mr-2" />
                Ajouter un nom de domaine
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de domaine personnalisé */}
      <CustomDomainDialog
        open={showDomainDialog}
        onOpenChange={setShowDomainDialog}
        sessionId={sessionId}
        cloudflareProjectName={cloudflareProjectName}
      />
    </>
  );
}
