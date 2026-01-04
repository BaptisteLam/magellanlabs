/**
 * Vue Table pour afficher les records d'un objet
 * Avec tri, filtres et sélection
 */

import { useObjects, useObjectDefinition, useObjectSelection } from '@/hooks/useCRMObjects';
import { DynamicFieldDisplay } from '../DynamicField';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Edit, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { QueryOptions } from '@/types/crm-objects';
import { useState } from 'react';

interface TableViewProps {
  projectId: string;
  objectType: string;
  queryOptions?: QueryOptions;
  onCreateRecord?: () => void;
  onEditRecord?: (recordId: string) => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  className?: string;
}

export function TableView({
  projectId,
  objectType,
  queryOptions,
  onCreateRecord,
  onEditRecord,
  onDeleteRecords,
  className,
}: TableViewProps) {
  const { data: definition, isLoading: defLoading } = useObjectDefinition(projectId, objectType);
  const { data: records, isLoading: recordsLoading } = useObjects(projectId, objectType, queryOptions);
  const { selectedIds, toggleSelection, selectAll, clearSelection, isSelected } = useObjectSelection();

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const isLoading = defLoading || recordsLoading;

  const handleSort = (fieldName: string) => {
    if (sortField === fieldName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldName);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === records?.length) {
      clearSelection();
    } else {
      selectAll(records?.map(r => r.id) || []);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-400">Définition d'objet non trouvée</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">
            {definition.pluralLabel}
          </h3>
          <span className="text-sm text-gray-500">
            ({records?.length || 0} {records?.length === 1 ? 'enregistrement' : 'enregistrements'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && onDeleteRecords && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDeleteRecords(selectedIds)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer ({selectedIds.length})
            </Button>
          )}

          {onCreateRecord && (
            <Button
              onClick={onCreateRecord}
              size="sm"
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden bg-surface/30 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === records?.length && records.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              {definition.fields.map((field) => (
                <TableHead
                  key={field.id}
                  className="cursor-pointer hover:bg-white/5"
                  onClick={() => handleSort(field.name)}
                >
                  <div className="flex items-center gap-2">
                    <span>{field.label}</span>
                    {sortField === field.name && (
                      <span className="text-cyan-400">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {records?.map((record) => (
              <TableRow
                key={record.id}
                className={cn(
                  'border-white/10 hover:bg-white/5 cursor-pointer',
                  isSelected(record.id) && 'bg-cyan-500/10'
                )}
                onClick={() => onEditRecord?.(record.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected(record.id)}
                    onCheckedChange={() => toggleSelection(record.id)}
                  />
                </TableCell>
                {definition.fields.map((field) => (
                  <TableCell key={field.id}>
                    <DynamicFieldDisplay
                      field={field}
                      value={record.data[field.name]}
                    />
                  </TableCell>
                ))}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEditRecord && (
                        <DropdownMenuItem onClick={() => onEditRecord(record.id)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                      )}
                      {onDeleteRecords && (
                        <DropdownMenuItem
                          className="text-red-400"
                          onClick={() => onDeleteRecords([record.id])}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {records?.length === 0 && (
              <TableRow>
                <TableCell colSpan={definition.fields.length + 2} className="h-96 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                      <Table className="w-8 h-8 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-1">
                        Aucun {definition.singularLabel.toLowerCase()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Créez votre premier enregistrement pour commencer
                      </p>
                    </div>
                    {onCreateRecord && (
                      <Button
                        onClick={onCreateRecord}
                        variant="outline"
                        className="mt-2"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Créer {definition.singularLabel.toLowerCase()}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
