/**
 * KanbanView - Vue Kanban avec drag & drop
 * Organise les records par colonnes de statut
 */

import { useState, useMemo } from 'react';
import { useObjects, useUpdateObject, useDeleteObjects } from '@/hooks/useCRMObjects';
import { ObjectDefinition, CustomObject } from '@/types/crm-objects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Plus, Trash2, Edit, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicFieldDisplay } from '../DynamicField';
import { toast } from 'sonner';

interface KanbanViewProps {
  projectId: string;
  objectType: string;
  definition: ObjectDefinition;
  queryOptions?: any;
  onCreateRecord?: () => void;
  onEditRecord?: (recordId: string) => void;
  onViewRecord?: (recordId: string) => void;
}

interface KanbanColumn {
  id: string;
  label: string;
  color: string;
  records: CustomObject[];
}

export function KanbanView({
  projectId,
  objectType,
  definition,
  queryOptions,
  onCreateRecord,
  onEditRecord,
  onViewRecord,
}: KanbanViewProps) {
  const { data: records = [], isLoading } = useObjects(projectId, objectType, queryOptions);
  const updateMutation = useUpdateObject(projectId, objectType);
  const deleteMutation = useDeleteObjects(projectId, objectType);

  const [draggedRecordId, setDraggedRecordId] = useState<string | null>(null);

  // Trouver le champ status dans la définition
  const statusField = useMemo(
    () => definition.fields.find((f) => f.type === 'status'),
    [definition]
  );

  // Créer les colonnes à partir des options du statut
  const columns = useMemo<KanbanColumn[]>(() => {
    if (!statusField || !statusField.config?.options) {
      // Pas de champ status, utiliser une colonne unique
      return [
        {
          id: 'all',
          label: 'Tous les records',
          color: '#03A5C0',
          records,
        },
      ];
    }

    const options = statusField.config.options;
    return options.map((option: any) => ({
      id: option.id,
      label: option.label,
      color: option.color || '#03A5C0',
      records: records.filter((r) => r.data[statusField.name] === option.id),
    }));
  }, [statusField, records]);

  const handleDragStart = (recordId: string) => {
    setDraggedRecordId(recordId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedRecordId || !statusField) return;

    const record = records.find((r) => r.id === draggedRecordId);
    if (!record) return;

    // Mettre à jour le statut
    try {
      await updateMutation.mutateAsync({
        id: draggedRecordId,
        data: {
          ...record.data,
          [statusField.name]: columnId,
        },
      });

      toast.success('Statut mis à jour');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setDraggedRecordId(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      await deleteMutation.mutateAsync([recordId]);
      toast.success('Record supprimé');
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Trouver les champs à afficher sur les cartes (max 3)
  const displayFields = definition.fields.filter((f) => f.isSearchable).slice(0, 3);

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 p-6 min-h-full">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            {/* Column Header */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <h3 className="text-sm font-semibold text-white">{column.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {column.records.length}
                  </Badge>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCreateRecord}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-0.5 w-full rounded-full" style={{ backgroundColor: column.color }} />
            </div>

            {/* Column Content */}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {column.records.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Aucun record
                </div>
              ) : (
                column.records.map((record) => (
                  <Card
                    key={record.id}
                    draggable
                    onDragStart={() => handleDragStart(record.id)}
                    className={cn(
                      'cursor-move hover:shadow-lg transition-shadow bg-surface/60 backdrop-blur-sm border-white/10',
                      draggedRecordId === record.id && 'opacity-50'
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium text-white">
                          {record.data[definition.fields[0]?.name] || 'Sans nom'}
                        </CardTitle>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewRecord?.(record.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditRecord?.(record.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(record.id)}
                              className="text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2">
                      {displayFields.map((field) => (
                        <div key={field.id} className="text-xs">
                          <span className="text-gray-400">{field.label}: </span>
                          <DynamicFieldDisplay
                            field={field}
                            value={record.data[field.name]}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
