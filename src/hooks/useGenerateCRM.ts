/**
 * Hook React pour la génération et gestion du CRM
 */

import { useState } from 'react';
import { crmGenerator, type CRMGenerationResult } from '@/services/crmGenerator';
import { toast } from 'sonner';

export function useGenerateCRM() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<CRMGenerationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Génère le CRM pour un projet
   */
  const generateCRM = async (projectId: string, userPrompt: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log('[useGenerateCRM] Starting CRM generation...');

      // Afficher une notification de démarrage
      toast.info('Génération du CRM en cours...', {
        description: 'Analyse de votre secteur d\'activité',
        duration: 3000,
      });

      const result = await crmGenerator.generateCRM(projectId, userPrompt);

      setGenerationResult(result);

      // Notification de succès avec détails
      toast.success('CRM généré avec succès !', {
        description: `${result.objects_count} objets créés pour ${result.business_description}`,
        duration: 5000,
      });

      console.log('[useGenerateCRM] CRM generation completed');

      return result;
    } catch (err) {
      const error = err as Error;
      console.error('[useGenerateCRM] CRM generation failed:', error);

      setError(error);

      toast.error('Erreur lors de la génération du CRM', {
        description: error.message || 'Une erreur est survenue',
        duration: 5000,
      });

      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateCRM,
    isGenerating,
    generationResult,
    error,
  };
}
