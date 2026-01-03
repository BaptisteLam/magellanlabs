/**
 * Service CRUD pour objets CRM flexibles
 * Gère les opérations sur object_definitions et custom_objects
 */

import { supabase } from '@/integrations/supabase/client';
import {
  ObjectDefinition,
  CustomObject,
  ObjectRelation,
  ObjectView,
  QueryOptions,
  FilterCondition,
  ValidationResult,
} from '@/types/crm-objects';
import { validateObjectData, sanitizeObjectData } from '@/lib/crm-validation';

// ============================================================================
// OBJECT DEFINITIONS - Gestion des définitions d'objets
// ============================================================================

class ObjectDefinitionService {
  /**
   * Récupère une définition d'objet par son nom
   */
  async getDefinition(projectId: string, objectType: string): Promise<ObjectDefinition | null> {
    const { data, error } = await supabase
      .from('object_definitions')
      .select('*')
      .eq('project_id', projectId)
      .eq('name', objectType)
      .single();

    if (error) {
      console.error('Error fetching object definition:', error);
      return null;
    }

    return data ? this.mapDefinition(data) : null;
  }

  /**
   * Liste toutes les définitions d'un projet
   */
  async listDefinitions(projectId: string): Promise<ObjectDefinition[]> {
    const { data, error } = await supabase
      .from('object_definitions')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error listing object definitions:', error);
      return [];
    }

    return data.map(this.mapDefinition);
  }

  /**
   * Crée une nouvelle définition d'objet
   */
  async createDefinition(
    projectId: string,
    definition: Omit<ObjectDefinition, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<ObjectDefinition> {
    const { data, error } = await supabase
      .from('object_definitions')
      .insert({
        project_id: projectId,
        name: definition.name,
        singular_label: definition.singularLabel,
        plural_label: definition.pluralLabel,
        icon: definition.icon,
        color: definition.color || '#03A5C0',
        description: definition.description,
        fields: definition.fields,
        view_config: definition.viewConfig,
        settings: definition.settings,
        is_system: definition.isSystem,
        generated_by_ai: definition.generatedByAi,
        display_order: definition.displayOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapDefinition(data);
  }

  /**
   * Met à jour une définition d'objet
   */
  async updateDefinition(
    projectId: string,
    objectType: string,
    updates: Partial<ObjectDefinition>
  ): Promise<ObjectDefinition> {
    const { data, error } = await supabase
      .from('object_definitions')
      .update({
        singular_label: updates.singularLabel,
        plural_label: updates.pluralLabel,
        icon: updates.icon,
        color: updates.color,
        description: updates.description,
        fields: updates.fields,
        view_config: updates.viewConfig,
        settings: updates.settings,
        display_order: updates.displayOrder,
      })
      .eq('project_id', projectId)
      .eq('name', objectType)
      .select()
      .single();

    if (error) throw error;
    return this.mapDefinition(data);
  }

  /**
   * Supprime une définition d'objet
   */
  async deleteDefinition(projectId: string, objectType: string): Promise<void> {
    const { error } = await supabase
      .from('object_definitions')
      .delete()
      .eq('project_id', projectId)
      .eq('name', objectType);

    if (error) throw error;
  }

  private mapDefinition(row: any): ObjectDefinition {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      singularLabel: row.singular_label,
      pluralLabel: row.plural_label,
      icon: row.icon,
      color: row.color,
      description: row.description,
      fields: row.fields || [],
      viewConfig: row.view_config,
      settings: row.settings,
      isSystem: row.is_system,
      generatedByAi: row.generated_by_ai,
      displayOrder: row.display_order || 0,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ============================================================================
// CUSTOM OBJECTS - Gestion des records
// ============================================================================

class CustomObjectService {
  private definitionService = new ObjectDefinitionService();

  /**
   * Crée un nouveau record
   */
  async create(
    projectId: string,
    objectType: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<CustomObject> {
    // Récupérer la définition pour validation
    const definition = await this.definitionService.getDefinition(projectId, objectType);
    if (!definition) {
      throw new Error(`Object type '${objectType}' not found in project ${projectId}`);
    }

    // Sanitize et valider les données
    const sanitized = sanitizeObjectData(data, definition);
    const validation = validateObjectData(sanitized, definition);

    if (!validation.success) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
    }

    // Insérer le record
    const { data: record, error } = await supabase
      .from('custom_objects')
      .insert({
        project_id: projectId,
        object_type: objectType,
        data: validation.data,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRecord(record);
  }

  /**
   * Récupère un record par ID
   */
  async findById(projectId: string, objectType: string, id: string): Promise<CustomObject | null> {
    const { data, error } = await supabase
      .from('custom_objects')
      .select('*')
      .eq('project_id', projectId)
      .eq('object_type', objectType)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching custom object:', error);
      return null;
    }

    return this.mapRecord(data);
  }

  /**
   * Liste des records avec filtres et pagination
   */
  async findMany(
    projectId: string,
    objectType: string,
    options: QueryOptions = {}
  ): Promise<CustomObject[]> {
    let query = supabase
      .from('custom_objects')
      .select('*')
      .eq('project_id', projectId)
      .eq('object_type', objectType);

    // Appliquer les filtres JSONB
    if (options.filters) {
      for (const filter of options.filters) {
        query = this.applyFilter(query, filter);
      }
    }

    // Recherche full-text
    if (options.search && options.searchFields) {
      const searchConditions = options.searchFields.map(
        field => `data->>${field}.ilike.%${options.search}%`
      );
      query = query.or(searchConditions.join(','));
    }

    // Tri
    if (options.orderBy) {
      const column = options.orderBy.field === 'createdAt'
        ? 'created_at'
        : options.orderBy.field === 'updatedAt'
        ? 'updated_at'
        : `data->>${options.orderBy.field}`;

      query = query.order(column, { ascending: options.orderBy.direction === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching custom objects:', error);
      return [];
    }

    return data.map(this.mapRecord);
  }

  /**
   * Compte le nombre de records
   */
  async count(
    projectId: string,
    objectType: string,
    filters?: FilterCondition[]
  ): Promise<number> {
    let query = supabase
      .from('custom_objects')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('object_type', objectType);

    if (filters) {
      for (const filter of filters) {
        query = this.applyFilter(query, filter);
      }
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting custom objects:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Met à jour un record
   */
  async update(
    projectId: string,
    objectType: string,
    id: string,
    data: Partial<Record<string, unknown>>
  ): Promise<CustomObject> {
    // Récupérer le record existant
    const existing = await this.findById(projectId, objectType, id);
    if (!existing) {
      throw new Error(`Record ${id} not found`);
    }

    // Récupérer la définition pour validation
    const definition = await this.definitionService.getDefinition(projectId, objectType);
    if (!definition) {
      throw new Error(`Object type '${objectType}' not found`);
    }

    // Merger les données
    const mergedData = { ...existing.data, ...data };

    // Sanitize et valider
    const sanitized = sanitizeObjectData(mergedData, definition);
    const validation = validateObjectData(sanitized, definition);

    if (!validation.success) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
    }

    // Mettre à jour
    const { data: record, error } = await supabase
      .from('custom_objects')
      .update({ data: validation.data })
      .eq('id', id)
      .eq('project_id', projectId)
      .eq('object_type', objectType)
      .select()
      .single();

    if (error) throw error;
    return this.mapRecord(record);
  }

  /**
   * Supprime un record
   */
  async delete(projectId: string, objectType: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('custom_objects')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .eq('object_type', objectType);

    if (error) throw error;
  }

  /**
   * Supprime plusieurs records
   */
  async deleteMany(projectId: string, objectType: string, ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('custom_objects')
      .delete()
      .eq('project_id', projectId)
      .eq('object_type', objectType)
      .in('id', ids);

    if (error) throw error;
  }

  /**
   * Applique un filtre JSONB à une query
   */
  private applyFilter(query: any, filter: FilterCondition) {
    const jsonPath = `data->>${filter.field}`;

    switch (filter.operator) {
      case 'eq':
        return query.eq(jsonPath, filter.value);
      case 'neq':
        return query.neq(jsonPath, filter.value);
      case 'gt':
        return query.gt(jsonPath, filter.value);
      case 'gte':
        return query.gte(jsonPath, filter.value);
      case 'lt':
        return query.lt(jsonPath, filter.value);
      case 'lte':
        return query.lte(jsonPath, filter.value);
      case 'contains':
        return query.ilike(jsonPath, `%${filter.value}%`);
      case 'in':
        return query.in(jsonPath, filter.value as unknown[]);
      case 'is_null':
        return query.is(jsonPath, null);
      case 'is_not_null':
        return query.not(jsonPath, 'is', null);
      default:
        return query;
    }
  }

  private mapRecord(row: any): CustomObject {
    return {
      id: row.id,
      projectId: row.project_id,
      objectType: row.object_type,
      data: row.data || {},
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ============================================================================
// OBJECT RELATIONS - Gestion des relations
// ============================================================================

class ObjectRelationService {
  /**
   * Crée une relation entre deux objets (avec backlink automatique)
   */
  async createRelation(
    projectId: string,
    relation: Omit<ObjectRelation, 'id' | 'projectId' | 'createdAt'>
  ): Promise<ObjectRelation> {
    const { data, error } = await supabase
      .from('object_relations')
      .insert({
        project_id: projectId,
        source_type: relation.sourceType,
        source_id: relation.sourceId,
        target_type: relation.targetType,
        target_id: relation.targetId,
        relation_type: relation.relationType,
        metadata: relation.metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // Créer le backlink automatiquement
    await supabase.from('object_relations').insert({
      project_id: projectId,
      source_type: relation.targetType,
      source_id: relation.targetId,
      target_type: relation.sourceType,
      target_id: relation.sourceId,
      relation_type: `${relation.relationType}_inverse`,
      metadata: { ...relation.metadata, isBacklink: true },
    });

    return this.mapRelation(data);
  }

  /**
   * Récupère les relations d'un objet
   */
  async getRelations(
    projectId: string,
    objectId: string,
    relationType?: string
  ): Promise<ObjectRelation[]> {
    let query = supabase
      .from('object_relations')
      .select('*')
      .eq('project_id', projectId)
      .eq('source_id', objectId);

    if (relationType) {
      query = query.eq('relation_type', relationType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching relations:', error);
      return [];
    }

    return data.map(this.mapRelation);
  }

  /**
   * Supprime une relation (et son backlink)
   */
  async deleteRelation(projectId: string, relationId: string): Promise<void> {
    const { error } = await supabase
      .from('object_relations')
      .delete()
      .eq('id', relationId)
      .eq('project_id', projectId);

    if (error) throw error;
  }

  private mapRelation(row: any): ObjectRelation {
    return {
      id: row.id,
      projectId: row.project_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      relationType: row.relation_type,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const objectDefinitionService = new ObjectDefinitionService();
export const customObjectService = new CustomObjectService();
export const objectRelationService = new ObjectRelationService();

// Export d'un service unifié
export const objectService = {
  definitions: objectDefinitionService,
  records: customObjectService,
  relations: objectRelationService,
};
