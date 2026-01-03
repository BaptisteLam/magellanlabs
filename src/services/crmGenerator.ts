/**
 * Service de génération CRM/ERP intelligent (modèle flexible JSONB)
 * Analyse le secteur d'activité et génère automatiquement des object_definitions
 */

import { supabase } from '@/integrations/supabase/client';
import { ObjectDefinition, FieldDefinition } from '@/types/crm-objects';

export interface CRMGenerationResult {
  success: boolean;
  business_sector: string;
  sector_confidence: number;
  business_description: string;
  objects_count: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export class CRMGeneratorService {
  /**
   * Génère les object_definitions CRM pour un projet
   * @param projectId ID du projet build_session
   * @param userPrompt Prompt initial de l'utilisateur
   * @returns Résultat de la génération avec secteur détecté et nombre d'objets créés
   */
  async generateCRM(
    projectId: string,
    userPrompt: string
  ): Promise<CRMGenerationResult> {
    console.log('[CRMGenerator] Starting CRM generation for project:', projectId);
    console.log('[CRMGenerator] User prompt:', userPrompt.substring(0, 100) + '...');

    try {
      // Appel à l'Edge Function Supabase (maintenant génère object_definitions)
      const { data, error } = await supabase.functions.invoke('generate-crm', {
        body: {
          projectId,
          userPrompt
        }
      });

      if (error) {
        console.error('[CRMGenerator] Error from Edge Function:', error);
        throw new Error(`CRM generation failed: ${error.message}`);
      }

      if (!data.success) {
        throw new Error('CRM generation returned success=false');
      }

      console.log('[CRMGenerator] CRM generated successfully');
      console.log(`[CRMGenerator] Sector: ${data.business_sector} (confidence: ${data.sector_confidence})`);
      console.log(`[CRMGenerator] Objects created: ${data.objects_count}`);
      console.log(`[CRMGenerator] Tokens used: ${data.token_usage.total_tokens} / 30000`);

      return data as CRMGenerationResult;
    } catch (error) {
      console.error('[CRMGenerator] Failed to generate CRM:', error);
      throw error;
    }
  }

  /**
   * Récupère les object_definitions d'un projet
   * @param projectId ID du projet
   * @returns Liste des object definitions
   */
  async getProjectObjects(projectId: string): Promise<ObjectDefinition[]> {
    console.log('[CRMGenerator] Fetching object definitions for project:', projectId);

    const { data: objects, error } = await supabase
      .from('object_definitions')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: false });

    if (error) {
      console.error('[CRMGenerator] Error fetching object definitions:', error);
      throw error;
    }

    console.log(`[CRMGenerator] Found ${objects?.length || 0} object definitions`);
    return (objects as ObjectDefinition[]) || [];
  }

  /**
   * Récupère une object_definition par nom
   * @param projectId ID du projet
   * @param objectType Nom de l'objet (ex: "contacts", "deals")
   * @returns La définition de l'objet
   */
  async getObjectDefinition(projectId: string, objectType: string): Promise<ObjectDefinition | null> {
    console.log('[CRMGenerator] Fetching object definition:', objectType);

    const { data: object, error } = await supabase
      .from('object_definitions')
      .select('*')
      .eq('project_id', projectId)
      .eq('name', objectType)
      .maybeSingle();

    if (error) {
      console.error('[CRMGenerator] Error fetching object definition:', error);
      throw error;
    }

    return object as ObjectDefinition | null;
  }

  /**
   * Crée une nouvelle object_definition
   * @param projectId ID du projet
   * @param objectData Données de l'objet
   * @returns L'object_definition créée
   */
  async createObjectDefinition(
    projectId: string,
    objectData: Partial<ObjectDefinition>
  ): Promise<ObjectDefinition> {
    console.log('[CRMGenerator] Creating object definition:', objectData.name);

    const { data, error } = await supabase
      .from('object_definitions')
      .insert({
        project_id: projectId,
        ...objectData,
        is_system: false,
        generated_by_ai: false
      })
      .select()
      .single();

    if (error) {
      console.error('[CRMGenerator] Error creating object definition:', error);
      throw error;
    }

    console.log('[CRMGenerator] Object definition created:', (data as ObjectDefinition).id);
    return data as ObjectDefinition;
  }

  /**
   * Met à jour une object_definition
   * @param objectId ID de l'object_definition
   * @param updates Données à mettre à jour
   */
  async updateObjectDefinition(objectId: string, updates: Partial<ObjectDefinition>) {
    console.log('[CRMGenerator] Updating object definition:', objectId);

    const { error } = await supabase
      .from('object_definitions')
      .update(updates)
      .eq('id', objectId);

    if (error) {
      console.error('[CRMGenerator] Error updating object definition:', error);
      throw error;
    }

    console.log('[CRMGenerator] Object definition updated successfully');
  }

  /**
   * Supprime une object_definition
   * @param objectId ID de l'object_definition
   */
  async deleteObjectDefinition(objectId: string) {
    console.log('[CRMGenerator] Deleting object definition:', objectId);

    const { error } = await supabase
      .from('object_definitions')
      .delete()
      .eq('id', objectId);

    if (error) {
      console.error('[CRMGenerator] Error deleting object definition:', error);
      throw error;
    }

    console.log('[CRMGenerator] Object definition deleted successfully');
  }

  /**
   * Ajoute un champ à une object_definition
   * @param objectId ID de l'object_definition
   * @param field Définition du nouveau champ
   */
  async addField(objectId: string, field: FieldDefinition) {
    console.log('[CRMGenerator] Adding field to object:', objectId, field.name);

    // Récupérer l'object_definition actuelle
    const { data: object, error: fetchError } = await supabase
      .from('object_definitions')
      .select('fields')
      .eq('id', objectId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Ajouter le nouveau champ
    const updatedFields = [...((object as any).fields || []), field];

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('object_definitions')
      .update({ fields: updatedFields })
      .eq('id', objectId);

    if (updateError) {
      throw updateError;
    }

    console.log('[CRMGenerator] Field added successfully');
  }

  /**
   * Met à jour un champ dans une object_definition
   * @param objectId ID de l'object_definition
   * @param fieldId ID du champ à modifier
   * @param updates Modifications du champ
   */
  async updateField(objectId: string, fieldId: string, updates: Partial<FieldDefinition>) {
    console.log('[CRMGenerator] Updating field:', fieldId);

    // Récupérer l'object_definition actuelle
    const { data: object, error: fetchError } = await supabase
      .from('object_definitions')
      .select('fields')
      .eq('id', objectId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Modifier le champ
    const updatedFields = ((object as any).fields || []).map((f: FieldDefinition) =>
      f.id === fieldId ? { ...f, ...updates } : f
    );

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('object_definitions')
      .update({ fields: updatedFields })
      .eq('id', objectId);

    if (updateError) {
      throw updateError;
    }

    console.log('[CRMGenerator] Field updated successfully');
  }

  /**
   * Supprime un champ d'une object_definition
   * @param objectId ID de l'object_definition
   * @param fieldId ID du champ à supprimer
   */
  async deleteField(objectId: string, fieldId: string) {
    console.log('[CRMGenerator] Deleting field:', fieldId);

    // Récupérer l'object_definition actuelle
    const { data: object, error: fetchError } = await supabase
      .from('object_definitions')
      .select('fields')
      .eq('id', objectId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Supprimer le champ
    const updatedFields = ((object as any).fields || []).filter(
      (f: FieldDefinition) => f.id !== fieldId
    );

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('object_definitions')
      .update({ fields: updatedFields })
      .eq('id', objectId);

    if (updateError) {
      throw updateError;
    }

    console.log('[CRMGenerator] Field deleted successfully');
  }
}

// Export d'une instance singleton
export const crmGenerator = new CRMGeneratorService();
