/**
 * Service CRUD pour objets CRM flexibles
 * Stub simplifié - les tables object_definitions et custom_objects n'existent pas encore
 * Ce fichier fournit une interface compatible pour éviter les erreurs de build
 */

import {
  ObjectDefinition,
  CustomObject,
  ObjectRelation,
  QueryOptions,
  FilterCondition,
} from '@/types/crm-objects';

// ============================================================================
// OBJECT DEFINITIONS - Service stub (tables non implémentées)
// ============================================================================

class ObjectDefinitionService {
  async getDefinition(projectId: string, objectType: string): Promise<ObjectDefinition | null> {
    console.warn('[ObjectDefinitionService] Table object_definitions not implemented yet');
    return null;
  }

  async listDefinitions(projectId: string): Promise<ObjectDefinition[]> {
    console.warn('[ObjectDefinitionService] Table object_definitions not implemented yet');
    return [];
  }

  async createDefinition(
    projectId: string,
    definition: Omit<ObjectDefinition, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<ObjectDefinition> {
    throw new Error('Table object_definitions not implemented yet');
  }

  async updateDefinition(
    projectId: string,
    objectType: string,
    updates: Partial<ObjectDefinition>
  ): Promise<ObjectDefinition> {
    throw new Error('Table object_definitions not implemented yet');
  }

  async deleteDefinition(projectId: string, objectType: string): Promise<void> {
    throw new Error('Table object_definitions not implemented yet');
  }
}

// ============================================================================
// CUSTOM OBJECTS - Service stub (tables non implémentées)
// ============================================================================

class CustomObjectService {
  async create(
    projectId: string,
    objectType: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<CustomObject> {
    throw new Error('Table custom_objects not implemented yet');
  }

  async findById(projectId: string, objectType: string, id: string): Promise<CustomObject | null> {
    console.warn('[CustomObjectService] Table custom_objects not implemented yet');
    return null;
  }

  async findMany(
    projectId: string,
    objectType: string,
    options: QueryOptions = {}
  ): Promise<CustomObject[]> {
    console.warn('[CustomObjectService] Table custom_objects not implemented yet');
    return [];
  }

  async count(
    projectId: string,
    objectType: string,
    filters?: FilterCondition[]
  ): Promise<number> {
    return 0;
  }

  async update(
    projectId: string,
    objectType: string,
    id: string,
    data: Partial<Record<string, unknown>>
  ): Promise<CustomObject> {
    throw new Error('Table custom_objects not implemented yet');
  }

  async delete(projectId: string, objectType: string, id: string): Promise<void> {
    throw new Error('Table custom_objects not implemented yet');
  }

  async deleteMany(projectId: string, objectType: string, ids: string[]): Promise<void> {
    throw new Error('Table custom_objects not implemented yet');
  }
}

// ============================================================================
// OBJECT RELATIONS - Service stub
// ============================================================================

class ObjectRelationService {
  async createRelation(
    projectId: string,
    relation: Omit<ObjectRelation, 'id' | 'projectId' | 'createdAt'>
  ): Promise<ObjectRelation> {
    throw new Error('Table object_relations not implemented yet');
  }

  async getRelations(
    projectId: string,
    objectId: string,
    relationType?: string
  ): Promise<ObjectRelation[]> {
    return [];
  }

  async deleteRelation(relationId: string): Promise<void> {
    throw new Error('Table object_relations not implemented yet');
  }
}

// ============================================================================
// OBJECT VIEWS - Service stub
// ============================================================================

class ObjectViewService {
  async getViews(projectId: string, objectType: string): Promise<any[]> {
    return [];
  }

  async saveView(projectId: string, objectType: string, view: any): Promise<any> {
    throw new Error('Not implemented yet');
  }

  async deleteView(viewId: string): Promise<void> {
    throw new Error('Not implemented yet');
  }
}

// ============================================================================
// Export des services
// ============================================================================

export const objectDefinitions = new ObjectDefinitionService();
export const customObjects = new CustomObjectService();
export const objectRelations = new ObjectRelationService();
export const objectViews = new ObjectViewService();

// Export groupé
export const objectService = {
  definitions: objectDefinitions,
  objects: customObjects,
  relations: objectRelations,
  views: objectViews,
};

export default objectService;
