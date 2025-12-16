import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RotateCcw, Loader2, Clock, CheckCircle } from 'lucide-react';
import { useProjectVersions, Version } from '@/hooks/useProjectVersions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VersionHistoryProps {
  sessionId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRollback: () => void;
}

export function VersionHistory({ sessionId, open, onOpenChange, onRollback }: VersionHistoryProps) {
  const { versions, isLoading, isRollingBack, fetchVersions, rollbackToVersion } = useProjectVersions(sessionId);
  const [confirmRollback, setConfirmRollback] = useState<Version | null>(null);

  useEffect(() => {
    if (open && sessionId) {
      fetchVersions();
    }
  }, [open, sessionId, fetchVersions]);

  const handleRollback = async () => {
    if (!confirmRollback) return;
    const success = await rollbackToVersion(confirmRollback.id);
    if (success) {
      onRollback();
      onOpenChange(false);
    }
    setConfirmRollback(null);
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "d MMM 'à' HH:mm", { locale: fr });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent" />
              Historique des versions
            </DialogTitle>
            <DialogDescription>
              Restaurez une version précédente de votre Worker Cloudflare. Les 10 dernières versions sont conservées.
            </DialogDescription>
          </DialogHeader>

          {/* Versions list */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading && versions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune version disponible</p>
                <p className="text-xs">Les versions sont créées automatiquement à chaque déploiement.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {version.message || `Version ${version.number || index + 1}`}
                        </span>
                        {version.isCurrent && (
                          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                            <CheckCircle className="h-3 w-3" />
                            Actuel
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(version.timestamp)}
                        </span>
                        {version.number && (
                          <span className="text-muted-foreground/60">
                            #{version.number}
                          </span>
                        )}
                      </div>
                    </div>
                    {!version.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRollback(version)}
                        disabled={isRollingBack}
                        className="shrink-0 ml-2 hover:text-accent"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmRollback} onOpenChange={() => setConfirmRollback(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre projet sera restauré à la version "{confirmRollback?.message || `Version ${confirmRollback?.number}`}". 
              Cette action déploiera immédiatement la version sélectionnée sur Cloudflare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack}
              style={{
                backgroundColor: 'rgb(3,165,192)',
                color: 'white',
              }}
            >
              {isRollingBack ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
