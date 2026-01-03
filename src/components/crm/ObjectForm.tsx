/**
 * Formulaire dynamique pour créer/éditer un objet CRM
 * Génère automatiquement les champs depuis la définition
 */

import { useDynamicForm, useCreateObject, useUpdateObject } from '@/hooks/useCRMObjects';
import { DynamicField } from './DynamicField';
import { Button } from '@/components/ui/button';
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CustomObject } from '@/types/crm-objects';

interface ObjectFormProps {
  projectId: string;
  objectType: string;
  recordId?: string;
  initialData?: Record<string, unknown>;
  onSuccess?: (record: CustomObject) => void;
  onCancel?: () => void;
  className?: string;
}

export function ObjectForm({
  projectId,
  objectType,
  recordId,
  initialData,
  onSuccess,
  onCancel,
  className,
}: ObjectFormProps) {
  const { toast } = useToast();
  const {
    definition,
    isLoading: definitionLoading,
    formData,
    errors,
    touched,
    updateField,
    validate,
    touchAll,
  } = useDynamicForm(projectId, objectType, initialData);

  const createMutation = useCreateObject(projectId, objectType);
  const updateMutation = useUpdateObject(projectId, objectType);

  const isEditing = !!recordId;
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Marquer tous les champs comme touchés pour afficher les erreurs
    touchAll();

    // Valider
    if (!validate()) {
      toast({
        title: 'Erreur de validation',
        description: 'Veuillez corriger les erreurs dans le formulaire',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = isEditing
        ? await updateMutation.mutateAsync({ id: recordId, data: formData })
        : await createMutation.mutateAsync(formData);

      toast({
        title: isEditing ? 'Modifié avec succès' : 'Créé avec succès',
        description: `${definition?.singularLabel} ${isEditing ? 'modifié' : 'créé'}`,
      });

      onSuccess?.(result);
    } catch (error) {
      console.error('Failed to save:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
    }
  };

  if (definitionLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Type d'objet non trouvé</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          {isEditing ? 'Modifier' : 'Créer'} {definition.singularLabel}
        </h2>
        {definition.description && (
          <p className="text-sm text-gray-400 mt-1">{definition.description}</p>
        )}
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {definition.fields.map((field) => (
          <div
            key={field.id}
            className={field.type === 'json' ? 'md:col-span-2' : ''}
          >
            <DynamicField
              field={field}
              value={formData[field.name]}
              onChange={(value) => updateField(field.name, value)}
              error={touched[field.name] ? errors[field.name] : undefined}
              disabled={mutation.isPending}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="bg-cyan-500 hover:bg-cyan-600 text-white"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {isEditing ? 'Enregistrer' : `Créer ${definition.singularLabel}`}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
