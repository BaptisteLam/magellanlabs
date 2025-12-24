/**
 * Hook: useCRMData
 *
 * Permet aux widgets CRM d'accéder aux données d'autres widgets
 * pour créer des dashboards composites
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WidgetData {
  widget_id: string;
  widget_title: string;
  widget_type: string;
  data: any;
  metadata?: any;
}

export interface UseCRMDataReturn {
  data: Record<string, WidgetData>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook pour accéder aux données d'autres widgets CRM
 *
 * @param widgetIds - Liste des IDs de widgets à récupérer
 * @returns Données des widgets, indexées par widget ID
 *
 * @example
 * ```tsx
 * const { data, loading } = useCRMData(['widget-id-1', 'widget-id-2']);
 *
 * if (!loading && data['widget-id-1']) {
 *   console.log('Données du widget 1:', data['widget-id-1'].data);
 * }
 * ```
 */
export function useCRMData(widgetIds: string[]): UseCRMDataReturn {
  const [data, setData] = useState<Record<string, WidgetData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCRMData = async () => {
    if (!widgetIds || widgetIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Récupérer les infos des widgets
      const { data: widgets, error: widgetsError } = await supabase
        .from('crm_widgets')
        .select('id, title, widget_type')
        .in('id', widgetIds);

      if (widgetsError) {
        throw widgetsError;
      }

      // Récupérer les données de chaque widget
      const { data: widgetDataList, error: dataError } = await supabase
        .from('widget_data')
        .select('widget_id, data, metadata')
        .in('widget_id', widgetIds);

      if (dataError) {
        throw dataError;
      }

      // Combiner les données
      const combinedData: Record<string, WidgetData> = {};

      widgets?.forEach((widget) => {
        const widgetData = widgetDataList?.find((d) => d.widget_id === widget.id);

        combinedData[widget.id] = {
          widget_id: widget.id,
          widget_title: widget.title,
          widget_type: widget.widget_type,
          data: widgetData?.data || null,
          metadata: widgetData?.metadata || {},
        };
      });

      setData(combinedData);
    } catch (err: any) {
      console.error('[useCRMData] Error fetching CRM data:', err);
      setError(err.message || 'Failed to fetch CRM data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMData();
  }, [widgetIds.join(',')]);

  return {
    data,
    loading,
    error,
    refetch: fetchCRMData,
  };
}

/**
 * Hook pour accéder aux données d'un widget spécifique
 *
 * @param widgetId - ID du widget
 * @returns Données du widget et fonction pour les mettre à jour
 *
 * @example
 * ```tsx
 * const { data, loading, updateData } = useWidgetData('widget-id');
 *
 * // Lire les données
 * console.log('Current data:', data);
 *
 * // Mettre à jour les données
 * await updateData({ sales: [...] });
 * ```
 */
export function useWidgetData(widgetId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!widgetId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: widgetData, error: fetchError } = await supabase
        .from('widget_data')
        .select('data')
        .eq('widget_id', widgetId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      setData(widgetData?.data || null);
    } catch (err: any) {
      console.error('[useWidgetData] Error fetching widget data:', err);
      setError(err.message || 'Failed to fetch widget data');
    } finally {
      setLoading(false);
    }
  };

  const updateData = async (newData: any) => {
    try {
      // Vérifier si une entrée existe déjà
      const { data: existing } = await supabase
        .from('widget_data')
        .select('id')
        .eq('widget_id', widgetId)
        .maybeSingle();

      if (existing) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('widget_data')
          .update({ data: newData, updated_at: new Date().toISOString() })
          .eq('widget_id', widgetId);

        if (updateError) throw updateError;
      } else {
        // Insertion
        const { error: insertError } = await supabase
          .from('widget_data')
          .insert({ widget_id: widgetId, data: newData });

        if (insertError) throw insertError;
      }

      setData(newData);
      return { success: true };
    } catch (err: any) {
      console.error('[useWidgetData] Error updating data:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchData();
  }, [widgetId]);

  return {
    data,
    loading,
    error,
    updateData,
    refetch: fetchData,
  };
}
