/**
 * useCredits - Hook pour gérer les crédits et l'utilisation
 * Affiche les crédits restants, le plan, et vérifie les limites
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PLANS, type PlanId } from '@/config/constants';

// ============= Types =============

export interface UsageData {
  plan: PlanId;
  messagesUsed: number;
  messagesLimit: number;
  remaining: number;
  canSend: boolean;
  cycleReset: string | null;
  totalTokens: number;
  totalCostUsd: number;
  generationCount: number;
  hasStripe: boolean;
}

// ============= Hook =============

export function useCredits() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        setError('VITE_SUPABASE_URL not configured');
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/vibesdk-usage`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      setUsage({
        plan: (data.plan || 'free') as PlanId,
        messagesUsed: data.messages_used || 0,
        messagesLimit: data.messages_limit || 5,
        remaining: data.remaining || 5,
        canSend: data.can_send ?? true,
        cycleReset: data.cycle_reset || null,
        totalTokens: data.total_tokens || 0,
        totalCostUsd: data.total_cost_usd || 0,
        generationCount: data.generation_count_this_month || 0,
        hasStripe: data.has_stripe || false,
      });
    } catch (err) {
      console.error('[useCredits] Error fetching usage:', err);
      // Retry once after 2s on network error
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession?.access_token) {
          const retryResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vibesdk-usage`, {
            headers: { 'Authorization': `Bearer ${retrySession.access_token}` },
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            setUsage({
              plan: (retryData.plan || 'free') as PlanId,
              messagesUsed: retryData.messages_used || 0,
              messagesLimit: retryData.messages_limit || 5,
              remaining: retryData.remaining || 5,
              canSend: retryData.can_send ?? true,
              cycleReset: retryData.cycle_reset || null,
              totalTokens: retryData.total_tokens || 0,
              totalCostUsd: retryData.total_cost_usd || 0,
              generationCount: retryData.generation_count_this_month || 0,
              hasStripe: retryData.has_stripe || false,
            });
            setError(null);
            return;
          }
        }
      } catch (retryErr) {
        console.error('[useCredits] Retry also failed:', retryErr);
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger au montage
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Calculer les infos du plan
  const planInfo = usage ? PLANS[usage.plan] : PLANS.free;

  const percentUsed = usage
    ? Math.min(100, (usage.messagesUsed / usage.messagesLimit) * 100)
    : 0;

  const isNearLimit = usage
    ? usage.remaining <= 1 && usage.remaining > 0
    : false;

  const isAtLimit = usage
    ? !usage.canSend
    : false;

  return {
    usage,
    isLoading,
    error,
    refetch: fetchUsage,

    // Computed
    planInfo,
    percentUsed,
    isNearLimit,
    isAtLimit,
    canDeploy: planInfo.features.deployment,
  };
}

export default useCredits;
