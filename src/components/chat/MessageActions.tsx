import { Undo2, Copy, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface MessageActionsProps {
  content: string;
  messageIndex: number;
  isLatestMessage: boolean;
  tokenCount?: number;
  onRestore?: (messageIndex: number) => void;
  onGoToPrevious?: () => void;
  isDark?: boolean;
  hideUndoButton?: boolean;
}

export function MessageActions({ 
  content, 
  messageIndex, 
  isLatestMessage, 
  tokenCount,
  onRestore,
  onGoToPrevious,
  isDark,
  hideUndoButton 
}: MessageActionsProps) {
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copié');
    } catch (error) {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleRestore = () => {
    if (onRestore) {
      onRestore(messageIndex);
    }
  };

  const handleGoBack = () => {
    if (isLatestMessage && onGoToPrevious) {
      onGoToPrevious();
    } else if (!isLatestMessage && onRestore) {
      onRestore(messageIndex);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      <TooltipProvider>
        {/* Bouton Retour en arrière - masqué pour les messages chat */}
        {!hideUndoButton && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="h-3 w-3 p-0 hover:bg-[#03A5C0]/10"
              >
                <Undo2 className="h-2 w-2" style={{ color: '#03A5C0' }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {isLatestMessage ? 'Revenir à la version précédente' : 'Revenir à cette version'}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Bouton Copier */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-3 w-3 p-0 hover:bg-[#03A5C0]/10"
            >
              <Copy className="h-2 w-2" style={{ color: '#03A5C0' }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Copier le message</p>
          </TooltipContent>
        </Tooltip>

        {/* Bouton Tokens supprimé pour simplifier l'UI et éviter les compteurs inexacts */}
      </TooltipProvider>
    </div>
  );
}
