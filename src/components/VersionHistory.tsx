import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RotateCcw, Plus, Loader2, FileText, Clock } from 'lucide-react';
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
  onRollback: (files: Record<string, string>) => void;
}

export function VersionHistory({ sessionId, open, onOpenChange, onRollback }: VersionHistoryProps) {
  const { versions, isLoading, isRollingBack, fetchVersions, createVersion, rollbackToVersion } = useProjectVersions(sessionId);
  const [newVersionMessage, setNewVersionMessage] = useState('');
  const [confirmRollback, setConfirmRollback] = useState<Version | null>(null);

  useEffect(() => {
    if (open && sessionId) {
      fetchVersions();
    }
  }, [open, sessionId, fetchVersions]);

  const handleCreateVersion = async () => {
    if (!newVersionMessage.trim()) return;
    const success = await createVersion(newVersionMessage.trim());
    if (success) {
      setNewVersionMessage('');
    }
  };

  const handleRollback = async () => {
    if (!confirmRollback) return;
    const files = await rollbackToVersion(confirmRollback.id);
    if (files) {
      onRollback(files);
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
              Restaurez une version précédente ou créez un point de sauvegarde. (10 versions max.)
            </DialogDescription>
          </DialogHeader>

          {/* Create new version */}
          <div className="flex gap-2">
            <Input
              placeholder="Nom de la version (ex: Avant refonte header)"
              value={newVersionMessage}
              onChange={(e) => setNewVersionMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateVersion()}
              className="flex-1"
            />
            <Button
              onClick={handleCreateVersion}
              disabled={!newVersionMessage.trim() || isLoading}
              size="sm"
              className="shrink-0"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)',
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Créer
            </Button>
          </div>

          {/* Versions list */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading && versions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune version sauvegardée</p>
                <p className="text-xs">Les versions sont créées automatiquement à chaque modification.</p>
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
                          {version.message}
                        </span>
                        {index === 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                            Actuel
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(version.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {version.filesCount} fichiers
                        </span>
                      </div>
                    </div>
                    {index !== 0 && (
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
              Votre projet sera restauré à l'état de "{confirmRollback?.message}". 
              Une nouvelle version de sauvegarde sera automatiquement créée avant la restauration.
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
