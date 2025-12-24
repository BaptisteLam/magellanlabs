/**
 * WidgetContextMenu - Menu contextuel pour les widgets CRM
 * Permet de dupliquer, éditer, exporter, supprimer un widget
 */

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreVertical,
  Copy,
  Edit3,
  Trash2,
  Download,
  Code,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { crmGenerator } from '@/services/crmGenerator';

export interface WidgetContextMenuProps {
  widgetId: string;
  widgetTitle: string;
  isCodeGenerated?: boolean;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onImportData?: () => void;
}

export function WidgetContextMenu({
  widgetId,
  widgetTitle,
  isCodeGenerated,
  onDuplicate,
  onEdit,
  onDelete,
  onRegenerate,
  onImportData,
}: WidgetContextMenuProps) {
  const { toast } = useToast();

  const handleDuplicate = async () => {
    try {
      toast({
        title: 'Duplication en cours...',
        description: `Duplication de "${widgetTitle}"`,
      });

      // TODO: Implémenter la duplication côté service
      await crmGenerator.duplicateWidget(widgetId);

      toast({
        title: 'Widget dupliqué !',
        description: `"${widgetTitle}" a été dupliqué avec succès`,
      });

      if (onDuplicate) {
        onDuplicate();
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la duplication',
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    try {
      // TODO: Implémenter l'export
      const widgetData = await crmGenerator.getModuleWidgets(widgetId);

      const dataStr = JSON.stringify(widgetData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `widget-${widgetTitle.toLowerCase().replace(/\s+/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Widget exporté !',
        description: 'Le fichier JSON a été téléchargé',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de l\'export',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${widgetTitle}" ?`)) {
      return;
    }

    try {
      await crmGenerator.deleteWidget(widgetId);

      toast({
        title: 'Widget supprimé',
        description: `"${widgetTitle}" a été supprimé`,
      });

      if (onDelete) {
        onDelete();
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la suppression',
        variant: 'destructive',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 z-10"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Edit3 className="mr-2 h-4 w-4" />
          Modifier via chat
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Dupliquer
        </DropdownMenuItem>

        {isCodeGenerated && onRegenerate && (
          <DropdownMenuItem onClick={onRegenerate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Régénérer
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {onImportData && (
          <DropdownMenuItem onClick={onImportData}>
            <Upload className="mr-2 h-4 w-4" />
            Importer des données
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Exporter JSON
        </DropdownMenuItem>

        {isCodeGenerated && (
          <DropdownMenuItem
            onClick={() => {
              // TODO: Afficher le code dans un dialog
              toast({
                title: 'Code source',
                description: 'Fonctionnalité à venir',
              });
            }}
          >
            <Code className="mr-2 h-4 w-4" />
            Voir le code
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
