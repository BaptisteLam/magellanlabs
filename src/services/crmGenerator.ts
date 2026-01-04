/**
 * Service de génération CRM/ERP intelligent
 * Utilise les tables crm_modules et crm_widgets existantes
 */

import { supabase } from '@/integrations/supabase/client';

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

interface Module {
  id: string;
  name: string;
  module_type: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  config?: any;
}

interface Widget {
  id: string;
  widget_type: string;
  title: string;
  config: any;
  layout: { x: number; y: number; w: number; h: number };
  is_visible: boolean;
  is_code_generated?: boolean;
  generated_code?: string;
  code_version?: number;
  data_sources?: any;
  display_order?: number;
}

export class CRMGeneratorService {
  /**
   * Génère le CRM pour un projet via Edge Function
   */
  async generateCRM(
    projectId: string,
    userPrompt: string
  ): Promise<CRMGenerationResult> {
    console.log('[CRMGenerator] Starting CRM generation for project:', projectId);

    try {
      const { data, error } = await supabase.functions.invoke('generate-crm', {
        body: { projectId, userPrompt }
      });

      if (error) {
        console.error('[CRMGenerator] Error from Edge Function:', error);
        throw new Error(`CRM generation failed: ${error.message}`);
      }

      if (!data.success) {
        throw new Error('CRM generation returned success=false');
      }

      console.log('[CRMGenerator] CRM generated successfully');
      return data as CRMGenerationResult;
    } catch (error) {
      console.error('[CRMGenerator] Failed to generate CRM:', error);
      throw error;
    }
  }

  /**
   * Récupère les modules d'un projet
   */
  async getProjectModules(projectId: string): Promise<Module[]> {
    console.log('[CRMGenerator] Fetching modules for project:', projectId);

    const { data, error } = await supabase
      .from('crm_modules')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[CRMGenerator] Error fetching modules:', error);
      throw error;
    }

    return (data || []).map(m => ({
      id: m.id,
      name: m.name,
      module_type: m.module_type,
      icon: m.icon || 'Box',
      display_order: m.display_order || 0,
      is_active: m.is_active ?? true,
      config: m.config
    }));
  }

  /**
   * Récupère les widgets d'un module
   */
  async getModuleWidgets(moduleId: string): Promise<Widget[]> {
    console.log('[CRMGenerator] Fetching widgets for module:', moduleId);

    const { data, error } = await supabase
      .from('crm_widgets')
      .select('*')
      .eq('module_id', moduleId)
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[CRMGenerator] Error fetching widgets:', error);
      throw error;
    }

    return (data || []).map(w => ({
      id: w.id,
      widget_type: w.widget_type,
      title: w.title,
      config: w.config || {},
      layout: (w.layout as any) || { x: 0, y: 0, w: 12, h: 4 },
      is_visible: w.is_visible ?? true,
      is_code_generated: w.is_code_generated ?? false,
      generated_code: w.generated_code || undefined,
      code_version: w.code_version || 1,
      data_sources: w.data_sources,
      display_order: w.display_order || 0
    }));
  }

  /**
   * Crée un nouveau widget
   */
  async createWidget(
    moduleId: string,
    widgetData: {
      widget_type: string;
      title: string;
      config?: any;
      layout?: { x: number; y: number; w: number; h: number };
    }
  ): Promise<Widget> {
    console.log('[CRMGenerator] Creating widget:', widgetData.title);

    const { data, error } = await supabase
      .from('crm_widgets')
      .insert({
        module_id: moduleId,
        widget_type: widgetData.widget_type,
        title: widgetData.title,
        config: widgetData.config || {},
        layout: widgetData.layout || { x: 0, y: 0, w: 12, h: 4 },
        is_visible: true,
        is_code_generated: false
      })
      .select()
      .single();

    if (error) {
      console.error('[CRMGenerator] Error creating widget:', error);
      throw error;
    }

    return {
      id: data.id,
      widget_type: data.widget_type,
      title: data.title,
      config: data.config || {},
      layout: (data.layout as any) || { x: 0, y: 0, w: 12, h: 4 },
      is_visible: true,
      is_code_generated: false,
      display_order: data.display_order || 0
    };
  }

  /**
   * Met à jour l'ordre des widgets
   */
  async updateWidgetOrder(widgets: { id: string; order: number }[]): Promise<void> {
    console.log('[CRMGenerator] Updating widget order');

    const updates = widgets.map(w =>
      supabase
        .from('crm_widgets')
        .update({ display_order: w.order })
        .eq('id', w.id)
    );

    await Promise.all(updates);
    console.log('[CRMGenerator] Widget order updated');
  }

  /**
   * Duplique un widget
   */
  async duplicateWidget(widgetId: string): Promise<Widget> {
    console.log('[CRMGenerator] Duplicating widget:', widgetId);

    // Récupérer le widget original
    const { data: original, error: fetchError } = await supabase
      .from('crm_widgets')
      .select('*')
      .eq('id', widgetId)
      .single();

    if (fetchError || !original) {
      throw new Error('Widget not found');
    }

    // Créer la copie
    const { data, error } = await supabase
      .from('crm_widgets')
      .insert({
        module_id: original.module_id,
        widget_type: original.widget_type,
        title: `${original.title} (copie)`,
        config: original.config,
        layout: original.layout,
        is_visible: true,
        is_code_generated: original.is_code_generated,
        generated_code: original.generated_code,
        data_sources: original.data_sources
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      widget_type: data.widget_type,
      title: data.title,
      config: data.config || {},
      layout: (data.layout as any) || { x: 0, y: 0, w: 12, h: 4 },
      is_visible: true,
      is_code_generated: data.is_code_generated ?? false,
      display_order: data.display_order || 0
    };
  }

  /**
   * Supprime un widget
   */
  async deleteWidget(widgetId: string): Promise<void> {
    console.log('[CRMGenerator] Deleting widget:', widgetId);

    const { error } = await supabase
      .from('crm_widgets')
      .delete()
      .eq('id', widgetId);

    if (error) {
      throw error;
    }

    console.log('[CRMGenerator] Widget deleted');
  }
}

// Export d'une instance singleton
export const crmGenerator = new CRMGeneratorService();
