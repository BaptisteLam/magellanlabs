/**
 * FieldBuilder - Constructeur de champs
 * Permet de gérer les champs d'une object_definition
 */

import { useState } from 'react';
import { FieldDefinition, FieldType } from '@/types/crm-objects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FieldBuilderProps {
  fields: FieldDefinition[];
  onChange: (fields: FieldDefinition[]) => void;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Texte', icon: '📝' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'phone', label: 'Téléphone', icon: '📞' },
  { value: 'url', label: 'URL', icon: '🔗' },
  { value: 'number', label: 'Nombre', icon: '🔢' },
  { value: 'currency', label: 'Devise', icon: '💰' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'datetime', label: 'Date & Heure', icon: '🕐' },
  { value: 'checkbox', label: 'Case à cocher', icon: '☑️' },
  { value: 'select', label: 'Liste déroulante', icon: '📋' },
  { value: 'multi_select', label: 'Multi-sélection', icon: '✅' },
  { value: 'status', label: 'Statut', icon: '🔄' },
  { value: 'relation', label: 'Relation', icon: '🔗' },
  { value: 'user', label: 'Utilisateur', icon: '👤' },
  { value: 'rating', label: 'Note', icon: '⭐' },
  { value: 'json', label: 'JSON', icon: '{}' },
];

function SortableFieldItem({ field, onEdit, onDelete }: { field: FieldDefinition; onEdit: () => void; onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldType = FIELD_TYPES.find((t) => t.value === field.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-surface/40 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white">{field.label}</span>
          <span className="text-xs text-gray-400 font-mono">({field.name})</span>
          {field.isRequired && <Badge variant="destructive" className="text-xs">Requis</Badge>}
          {field.isUnique && <Badge variant="outline" className="text-xs">Unique</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{fieldType?.icon}</span>
          <span>{fieldType?.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-400 hover:text-red-300"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function FieldBuilder({ fields, onChange }: FieldBuilderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isSearchable, setIsSearchable] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      onChange(arrayMove(fields, oldIndex, newIndex));
    }
  };

  const handleAddField = () => {
    setEditingField(null);
    setEditingIndex(null);
    setFieldName('');
    setFieldLabel('');
    setFieldType('text');
    setIsRequired(false);
    setIsUnique(false);
    setIsSearchable(true);
    setIsDialogOpen(true);
  };

  const handleEditField = (index: number) => {
    const field = fields[index];
    setEditingField(field);
    setEditingIndex(index);
    setFieldName(field.name);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setIsRequired(field.isRequired);
    setIsUnique(field.isUnique);
    setIsSearchable(field.isSearchable);
    setIsDialogOpen(true);
  };

  const handleDeleteField = (index: number) => {
    if (confirm('Voulez-vous vraiment supprimer ce champ ?')) {
      onChange(fields.filter((_, i) => i !== index));
    }
  };

  const handleSaveField = () => {
    if (!fieldName || !fieldLabel) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newField: FieldDefinition = {
      id: editingField?.id || `fld_${Date.now()}`,
      name: fieldName,
      label: fieldLabel,
      type: fieldType,
      isRequired,
      isUnique,
      isSearchable,
      config: {},
    };

    if (editingIndex !== null) {
      // Update existing
      const updated = [...fields];
      updated[editingIndex] = newField;
      onChange(updated);
    } else {
      // Add new
      onChange([...fields, newField]);
    }

    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Fields List */}
      {fields.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <p className="text-gray-400 mb-4">Aucun champ défini</p>
            <Button onClick={handleAddField} className="bg-cyan-500 hover:bg-cyan-600">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter votre premier champ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{fields.length} champ(s)</p>
            <Button onClick={handleAddField} size="sm" className="bg-cyan-500 hover:bg-cyan-600">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un champ
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onEdit={() => handleEditField(index)}
                    onDelete={() => handleDeleteField(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Add/Edit Field Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-surface border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingField ? 'Modifier le champ' : 'Nouveau champ'}
            </DialogTitle>
            <DialogDescription>
              Configurez les propriétés du champ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Field Name */}
              <div className="space-y-2">
                <Label htmlFor="fieldName">
                  Nom technique <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fieldName"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="email"
                  className="font-mono"
                />
              </div>

              {/* Field Label */}
              <div className="space-y-2">
                <Label htmlFor="fieldLabel">
                  Label <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fieldLabel"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="Adresse email"
                />
              </div>
            </div>

            {/* Field Type */}
            <div className="space-y-2">
              <Label>Type de champ</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={isRequired}
                  onCheckedChange={(checked) => setIsRequired(checked as boolean)}
                />
                <span className="text-sm">Champ requis</span>
              </label>

              <label className="flex items-center gap-2">
                <Checkbox
                  checked={isUnique}
                  onCheckedChange={(checked) => setIsUnique(checked as boolean)}
                />
                <span className="text-sm">Valeur unique (pas de doublons)</span>
              </label>

              <label className="flex items-center gap-2">
                <Checkbox
                  checked={isSearchable}
                  onCheckedChange={(checked) => setIsSearchable(checked as boolean)}
                />
                <span className="text-sm">Champ interrogeable (pour la recherche)</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveField} className="bg-cyan-500 hover:bg-cyan-600">
              {editingField ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
