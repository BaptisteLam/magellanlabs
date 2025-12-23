/**
 * Service de génération CRM/ERP intelligent
 * Analyse le secteur d'activité et génère automatiquement des modules métier
 */

import { supabase } from '@/integrations/supabase/client';

export interface ModuleSpec {
  name: string;
  module_type: string;
  icon: string;
  priority: number;
  description: string;
  widgets: WidgetSpec[];
}

export interface WidgetSpec {
  widget_type: string;
  title: string;
  config: any;
  layout?: { x: number; y: number; w: number; h: number };
}

export interface CRMGenerationResult {
  success: boolean;
  business_sector: string;
  sector_confidence: number;
  business_description: string;
  modules_count: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export class CRMGeneratorService {
  /**
   * Génère les modules CRM pour un projet
   * @param projectId ID du projet build_session
   * @param userPrompt Prompt initial de l'utilisateur
   * @returns Résultat de la génération avec secteur détecté et nombre de modules créés
   */
  async generateCRM(
    projectId: string,
    userPrompt: string
  ): Promise<CRMGenerationResult> {
    console.log('[CRMGenerator] Starting CRM generation for project:', projectId);
    console.log('[CRMGenerator] User prompt:', userPrompt.substring(0, 100) + '...');

    try {
      // Appel à l'Edge Function Supabase
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
      console.log(`[CRMGenerator] Modules created: ${data.modules_count}`);
      console.log(`[CRMGenerator] Tokens used: ${data.token_usage.total_tokens} / 30000`);

      return data as CRMGenerationResult;
    } catch (error) {
      console.error('[CRMGenerator] Failed to generate CRM:', error);
      throw error;
    }
  }

  /**
   * Récupère les modules CRM d'un projet
   * @param projectId ID du projet
   * @returns Liste des modules avec leurs widgets
   */
  async getProjectModules(projectId: string) {
    console.log('[CRMGenerator] Fetching modules for project:', projectId);

    const { data: modules, error } = await supabase
      .from('crm_modules')
      .select(`
        *,
        widgets:crm_widgets(*)
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('display_order', { ascending: false }); // priority DESC

    if (error) {
      console.error('[CRMGenerator] Error fetching modules:', error);
      throw error;
    }

    console.log(`[CRMGenerator] Found ${modules?.length || 0} modules`);
    return modules || [];
  }

  /**
   * Récupère les widgets d'un module
   * @param moduleId ID du module
   * @returns Liste des widgets avec leurs données
   */
  async getModuleWidgets(moduleId: string) {
    console.log('[CRMGenerator] Fetching widgets for module:', moduleId);

    const { data: widgets, error } = await supabase
      .from('crm_widgets')
      .select(`
        *,
        data:widget_data(*)
      `)
      .eq('module_id', moduleId)
      .eq('is_visible', true)
      .order('display_order');

    if (error) {
      console.error('[CRMGenerator] Error fetching widgets:', error);
      throw error;
    }

    console.log(`[CRMGenerator] Found ${widgets?.length || 0} widgets`);
    return widgets || [];
  }

  /**
   * Met à jour les données d'un widget
   * @param widgetId ID du widget
   * @param data Nouvelles données
   */
  async updateWidgetData(widgetId: string, data: any) {
    console.log('[CRMGenerator] Updating widget data:', widgetId);

    // Vérifier si des données existent déjà
    const { data: existing } = await supabase
      .from('widget_data')
      .select('id')
      .eq('widget_id', widgetId)
      .maybeSingle();

    if (existing) {
      // Update
      const { error } = await supabase
        .from('widget_data')
        .update({ data, updated_at: new Date().toISOString() })
        .eq('widget_id', widgetId);

      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from('widget_data')
        .insert({ widget_id: widgetId, data });

      if (error) throw error;
    }

    console.log('[CRMGenerator] Widget data updated successfully');
  }

  /**
   * Crée un nouveau widget dans un module (via prompt utilisateur)
   * @param moduleId ID du module
   * @param widgetSpec Spécification du widget
   */
  async createWidget(moduleId: string, widgetSpec: WidgetSpec) {
    console.log('[CRMGenerator] Creating widget:', widgetSpec.title);

    const { data, error } = await supabase
      .from('crm_widgets')
      .insert({
        module_id: moduleId,
        widget_type: widgetSpec.widget_type,
        title: widgetSpec.title,
        config: widgetSpec.config,
        layout: widgetSpec.layout || { x: 0, y: 0, w: 12, h: 4 },
        is_visible: true
      })
      .select()
      .single();

    if (error) {
      console.error('[CRMGenerator] Error creating widget:', error);
      throw error;
    }

    console.log('[CRMGenerator] Widget created:', data.id);
    return data;
  }

  /**
   * Supprime un widget
   * @param widgetId ID du widget
   */
  async deleteWidget(widgetId: string) {
    console.log('[CRMGenerator] Deleting widget:', widgetId);

    const { error } = await supabase
      .from('crm_widgets')
      .delete()
      .eq('id', widgetId);

    if (error) {
      console.error('[CRMGenerator] Error deleting widget:', error);
      throw error;
    }

    console.log('[CRMGenerator] Widget deleted successfully');
  }

  /**
   * Met à jour la configuration d'un widget
   * @param widgetId ID du widget
   * @param config Nouvelle configuration
   */
  async updateWidgetConfig(widgetId: string, config: any) {
    console.log('[CRMGenerator] Updating widget config:', widgetId);

    const { error } = await supabase
      .from('crm_widgets')
      .update({ config, updated_at: new Date().toISOString() })
      .eq('id', widgetId);

    if (error) {
      console.error('[CRMGenerator] Error updating widget config:', error);
      throw error;
    }

    console.log('[CRMGenerator] Widget config updated successfully');
  }
}

// Export d'une instance singleton
export const crmGenerator = new CRMGeneratorService();
