/**
 * Canvas principal du CRM - Interface bac à sable
 * Affiche les vues (Table, Kanban, Timeline) et gère le mode édition
 */

import { useState } from 'react';
import { ViewType } from '@/types/crm-objects';
import { ViewSwitcher } from './ViewSwitcher';
import { TableView } from './views/TableView';
import { KanbanView } from './views/KanbanView';
import { TimelineView } from './views/TimelineView';
import { CalendarView } from './views/CalendarView';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Filter, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ObjectForm } from './ObjectForm';
import { useToast } from '@/hooks/use-toast';
import { useDeleteManyObjects, useObjectDefinition } from '@/hooks/useCRMObjects';

interface CanvasProps {
  projectId: string;
  objectType: string;
  className?: string;
}

export function Canvas({ projectId, objectType, className }: CanvasProps) {
  const { toast } = useToast();
  const { data: definition } = useObjectDefinition(projectId, objectType);
  const [currentView, setCurrentView] = useState<ViewType>('table');
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const deleteMutation = useDeleteManyObjects(projectId, objectType);

  const handleCreateRecord = () => {
    setEditingRecordId(null);
    setShowCreateForm(true);
  };

  const handleEditRecord = (recordId: string) => {
    setEditingRecordId(recordId);
    setShowCreateForm(true);
  };

  const handleDeleteRecords = async (recordIds: string[]) => {
    if (!confirm(`Voulez-vous vraiment supprimer ${recordIds.length} enregistrement(s) ?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(recordIds);
      toast({
        title: 'Supprimé avec succès',
        description: `${recordIds.length} enregistrement(s) supprimé(s)`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer les enregistrements',
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingRecordId(null);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface/30 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* View Switcher */}
          <ViewSwitcher
            currentView={currentView}
            onViewChange={setCurrentView}
          />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 w-64 bg-white/5 border-white/10"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters (à implémenter plus tard) */}
          <Button variant="ghost" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </Button>

          {/* Edit Mode Toggle */}
          <Button
            variant={editMode ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className={editMode ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
          >
            {editMode ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Mode Lecture
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Mode Édition
              </>
            )}
          </Button>

          {/* Create Button */}
          <Button
            onClick={handleCreateRecord}
            size="sm"
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-auto">
        {!definition ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {currentView === 'table' && (
              <div className="p-6">
                <TableView
                  projectId={projectId}
                  objectType={objectType}
                  definition={definition}
                  queryOptions={{
                    search: searchQuery || undefined,
                    searchFields: ['name', 'email', 'title'],
                  }}
                  onCreateRecord={handleCreateRecord}
                  onEditRecord={handleEditRecord}
                  onDeleteRecords={handleDeleteRecords}
                />
              </div>
            )}

            {currentView === 'kanban' && (
              <KanbanView
                projectId={projectId}
                objectType={objectType}
                definition={definition}
                queryOptions={{
                  search: searchQuery || undefined,
                }}
                onCreateRecord={handleCreateRecord}
                onEditRecord={handleEditRecord}
              />
            )}

            {currentView === 'timeline' && (
              <TimelineView
                projectId={projectId}
                objectType={objectType}
                definition={definition}
                queryOptions={{
                  search: searchQuery || undefined,
                }}
                onEditRecord={handleEditRecord}
              />
            )}

            {currentView === 'calendar' && (
              <CalendarView
                projectId={projectId}
                objectType={objectType}
                definition={definition}
                queryOptions={{
                  search: searchQuery || undefined,
                }}
                onCreateRecord={handleCreateRecord}
                onEditRecord={handleEditRecord}
              />
            )}
          </>
        )}
      </div>

      {/* Edit Mode Indicator */}
      {editMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-cyan-500 text-white rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom">
          <Edit className="w-4 h-4" />
          <span className="text-sm font-medium">Mode Édition Activé</span>
          <span className="text-xs opacity-80">Survolez les éléments pour les modifier</span>
        </div>
      )}

      {/* Create/Edit Form Sheet */}
      <Sheet open={showCreateForm} onOpenChange={setShowCreateForm}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] bg-surface border-white/10">
          <SheetHeader>
            <SheetTitle className="text-white">
              {editingRecordId ? 'Modifier' : 'Créer'}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ObjectForm
              projectId={projectId}
              objectType={objectType}
              recordId={editingRecordId || undefined}
              onSuccess={handleFormSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
