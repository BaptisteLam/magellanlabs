/**
 * Hook: useSiteData
 *
 * Permet aux widgets CRM d'accéder aux données du site web
 * (formulaires, sections, analytics, etc.)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';

export interface SiteData {
  sections?: any[];
  forms?: Record<string, any>;
  analytics?: any;
  metadata?: any;
}

export interface UseSiteDataReturn {
  data: SiteData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook pour accéder aux données du site web
 *
 * @param formNames - Liste des noms de formulaires à récupérer (optionnel)
 * @returns Données du site, état de chargement, erreur
 *
 * @example
 * ```tsx
 * const { data, loading } = useSiteData(['contact', 'newsletter']);
 *
 * if (!loading && data.forms?.contact) {
 *   console.log('Soumissions contact:', data.forms.contact.submissions);
 * }
 * ```
 */
export function useSiteData(formNames?: string[]): UseSiteDataReturn {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<SiteData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSiteData = async () => {
    if (!projectId) {
      setError('No project ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: buildSession, error: fetchError } = await supabase
        .from('build_sessions')
        .select('sections, forms, analytics, metadata')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!buildSession) {
        throw new Error('Project not found');
      }

      // Filtrer les formulaires si spécifié
      let filteredData: SiteData = {
        sections: buildSession.sections || [],
        analytics: buildSession.analytics || {},
        metadata: buildSession.metadata || {},
      };

      if (formNames && buildSession.forms) {
        const filteredForms: Record<string, any> = {};
        formNames.forEach((name) => {
          if (buildSession.forms[name]) {
            filteredForms[name] = buildSession.forms[name];
          }
        });
        filteredData.forms = filteredForms;
      } else {
        filteredData.forms = buildSession.forms || {};
      }

      setData(filteredData);
    } catch (err: any) {
      console.error('[useSiteData] Error fetching site data:', err);
      setError(err.message || 'Failed to fetch site data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteData();
  }, [projectId, formNames?.join(',')]);

  return {
    data,
    loading,
    error,
    refetch: fetchSiteData,
  };
}

/**
 * Hook pour accéder aux soumissions d'un formulaire spécifique
 *
 * @param formName - Nom du formulaire
 * @returns Soumissions du formulaire
 *
 * @example
 * ```tsx
 * const { submissions, loading } = useFormSubmissions('contact');
 *
 * if (!loading) {
 *   console.log(`${submissions.length} soumissions`);
 * }
 * ```
 */
export function useFormSubmissions(formName: string) {
  const { data, loading, error, refetch } = useSiteData([formName]);

  return {
    submissions: data.forms?.[formName]?.submissions || [],
    loading,
    error,
    refetch,
  };
}
