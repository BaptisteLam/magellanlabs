/**
 * React hooks pour le CRM flexible
 * Utilise React Query pour la gestion du cache et de l'état serveur
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { objectService } from '@/services/objectService';
import {
  ObjectDefinition,
  CustomObject,
  QueryOptions,
  ObjectRelation,
} from '@/types/crm-objects';
import { validateObjectData, getDefaultValueForField } from '@/lib/crm-validation';

// ============================================================================
// HOOKS POUR OBJECT DEFINITIONS
// ============================================================================

/**
 * Récupère une définition d'objet
 */
export function useObjectDefinition(projectId: string, objectType: string) {
  return useQuery({
    queryKey: ['object-definition', projectId, objectType],
    queryFn: () => objectService.definitions.getDefinition(projectId, objectType),
    enabled: !!projectId && !!objectType,
    staleTime: 1000 * 60 * 10, // Cache 10 minutes (définitions changent rarement)
  });
}

/**
 * Liste toutes les définitions d'un projet
 */
export function useObjectDefinitions(projectId: string) {
  return useQuery({
    queryKey: ['object-definitions', projectId],
    queryFn: () => objectService.definitions.listDefinitions(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
  });
}

/**
 * Crée une nouvelle définition d'objet
 */
export function useCreateObjectDefinition(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definition: Omit<ObjectDefinition, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) =>
      objectService.definitions.createDefinition(projectId, definition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object-definitions', projectId] });
    },
  });
}

/**
 * Met à jour une définition d'objet
 */
export function useUpdateObjectDefinition(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ objectType, updates }: { objectType: string; updates: Partial<ObjectDefinition> }) =>
      objectService.definitions.updateDefinition(projectId, objectType, updates),
    onSuccess: (_, { objectType }) => {
      queryClient.invalidateQueries({ queryKey: ['object-definitions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['object-definition', projectId, objectType] });
    },
  });
}

// ============================================================================
// HOOKS POUR CUSTOM OBJECTS (RECORDS)
// ============================================================================

/**
 * Liste des records d'un type d'objet avec options
 */
export function useObjects(projectId: string, objectType: string, options?: QueryOptions) {
  return useQuery({
    queryKey: ['objects', projectId, objectType, options],
    queryFn: () => objectService.records.findMany(projectId, objectType, options),
    enabled: !!projectId && !!objectType,
    staleTime: 1000 * 30, // Cache 30 secondes (données plus volatiles)
  });
}

/**
 * Récupère un record par ID
 */
export function useObject(projectId: string, objectType: string, id: string) {
  return useQuery({
    queryKey: ['object', projectId, objectType, id],
    queryFn: () => objectService.records.findById(projectId, objectType, id),
    enabled: !!projectId && !!objectType && !!id,
  });
}

/**
 * Compte le nombre de records
 */
export function useObjectsCount(projectId: string, objectType: string, options?: QueryOptions) {
  return useQuery({
    queryKey: ['objects-count', projectId, objectType, options?.filters],
    queryFn: () => objectService.records.count(projectId, objectType, options?.filters),
    enabled: !!projectId && !!objectType,
  });
}

/**
 * Crée un nouveau record
 */
export function useCreateObject(projectId: string, objectType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      objectService.records.create(projectId, objectType, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', projectId, objectType] });
      queryClient.invalidateQueries({ queryKey: ['objects-count', projectId, objectType] });
    },
  });
}

/**
 * Met à jour un record
 */
export function useUpdateObject(projectId: string, objectType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Record<string, unknown>> }) =>
      objectService.records.update(projectId, objectType, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['objects', projectId, objectType] });
      queryClient.invalidateQueries({ queryKey: ['object', projectId, objectType, id] });
    },
  });
}

/**
 * Supprime un record
 */
export function useDeleteObject(projectId: string, objectType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      objectService.records.delete(projectId, objectType, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', projectId, objectType] });
      queryClient.invalidateQueries({ queryKey: ['objects-count', projectId, objectType] });
    },
  });
}

/**
 * Supprime plusieurs records
 */
export function useDeleteManyObjects(projectId: string, objectType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      objectService.records.deleteMany(projectId, objectType, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', projectId, objectType] });
      queryClient.invalidateQueries({ queryKey: ['objects-count', projectId, objectType] });
    },
  });
}

// ============================================================================
// HOOKS POUR RELATIONS
// ============================================================================

/**
 * Récupère les relations d'un objet
 */
export function useObjectRelations(projectId: string, objectId: string, relationType?: string) {
  return useQuery({
    queryKey: ['object-relations', projectId, objectId, relationType],
    queryFn: () => objectService.relations.getRelations(projectId, objectId, relationType),
    enabled: !!projectId && !!objectId,
  });
}

/**
 * Crée une relation
 */
export function useCreateRelation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (relation: Omit<ObjectRelation, 'id' | 'projectId' | 'createdAt'>) =>
      objectService.relations.createRelation(projectId, relation),
    onSuccess: (_, relation) => {
      queryClient.invalidateQueries({ queryKey: ['object-relations', projectId, relation.sourceId] });
      queryClient.invalidateQueries({ queryKey: ['object-relations', projectId, relation.targetId] });
    },
  });
}

/**
 * Supprime une relation
 */
export function useDeleteRelation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (relationId: string) =>
      objectService.relations.deleteRelation(projectId, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object-relations', projectId] });
    },
  });
}

// ============================================================================
// HOOK POUR FORMULAIRE DYNAMIQUE
// ============================================================================

export function useDynamicForm(
  projectId: string,
  objectType: string,
  initialData?: Record<string, unknown>
) {
  const { data: definition, isLoading } = useObjectDefinition(projectId, objectType);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Initialiser les valeurs par défaut
  useState(() => {
    if (definition && !initialData) {
      const defaults: Record<string, unknown> = {};
      for (const field of definition.fields) {
        defaults[field.name] = getDefaultValueForField(field);
      }
      setFormData(defaults);
    }
  });

  /**
   * Met à jour un champ
   */
  const updateField = useCallback((fieldName: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    setTouched(prev => ({ ...prev, [fieldName]: true }));

    // Nettoyer l'erreur du champ
    setErrors(prev => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Valide le formulaire complet
   */
  const validate = useCallback((): boolean => {
    if (!definition) return false;

    const result = validateObjectData(formData, definition);

    if (!result.success && result.errors) {
      setErrors(result.errors);
      return false;
    }

    setErrors({});
    return true;
  }, [definition, formData]);

  /**
   * Valide un champ individuel
   */
  const validateField = useCallback((fieldName: string): boolean => {
    if (!definition) return true;

    const field = definition.fields.find(f => f.name === fieldName);
    if (!field) return true;

    const tempDef = { ...definition, fields: [field] };
    const result = validateObjectData({ [fieldName]: formData[fieldName] }, tempDef);

    if (!result.success && result.errors) {
      setErrors(prev => ({ ...prev, ...result.errors }));
      return false;
    }

    return true;
  }, [definition, formData]);

  /**
   * Reset le formulaire
   */
  const reset = useCallback((data?: Record<string, unknown>) => {
    setFormData(data ?? {});
    setErrors({});
    setTouched({});
  }, []);

  /**
   * Marque tous les champs comme touched (pour afficher les erreurs)
   */
  const touchAll = useCallback(() => {
    if (!definition) return;

    const allTouched: Record<string, boolean> = {};
    for (const field of definition.fields) {
      allTouched[field.name] = true;
    }
    setTouched(allTouched);
  }, [definition]);

  /**
   * Vérifie si le formulaire a changé
   */
  const isDirty = useCallback((): boolean => {
    if (!initialData) return Object.keys(formData).length > 0;

    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  return {
    definition,
    isLoading,
    formData,
    errors,
    touched,
    updateField,
    validate,
    validateField,
    reset,
    setFormData,
    touchAll,
    isDirty: isDirty(),
  };
}

// ============================================================================
// HOOK POUR SÉLECTION MULTIPLE
// ============================================================================

export function useObjectSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  };
}
