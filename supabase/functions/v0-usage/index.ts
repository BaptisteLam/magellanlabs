import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * v0-usage Edge Function
 *
 * Retourne les informations d'utilisation et de crédits de l'utilisateur.
 *
 * GET /v0-usage
 * Returns: { plan, messages_used, messages_limit, remaining, can_send, cycle_reset, total_tokens, total_cost }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Check credits via RPC ----
    const { data: credits, error: creditsError } = await supabase
      .rpc('check_user_credits', { p_user_id: user.id });

    if (creditsError) {
      console.error('[v0-usage] Error checking credits:', creditsError);
      return new Response(
        JSON.stringify({ error: 'Failed to check credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creditInfo = credits?.[0] || {
      messages_used: 0,
      messages_limit: 5,
      remaining: 5,
      plan: 'free',
      can_send: true,
      cycle_reset: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    };

    // ---- Get billing details ----
    const { data: billing } = await supabase
      .from('billing')
      .select('total_tokens_used, total_cost_usd, billing_cycle_start, billing_cycle_end, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // ---- Get generation count for this month ----
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: generationCount } = await supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    // ---- Optionally fetch v0 billing info ----
    let v0Billing = null;
    const V0_API_KEY = Deno.env.get('V0_API_KEY');
    if (V0_API_KEY) {
      try {
        const v0Response = await fetch('https://api.v0.dev/v1/rate-limits', {
          headers: { 'Authorization': `Bearer ${V0_API_KEY}` },
        });
        if (v0Response.ok) {
          v0Billing = await v0Response.json();
        }
      } catch (e) {
        console.warn('[v0-usage] Could not fetch v0 billing:', e);
      }
    }

    // ---- Response ----
    return new Response(
      JSON.stringify({
        plan: creditInfo.plan,
        messages_used: creditInfo.messages_used,
        messages_limit: creditInfo.messages_limit,
        remaining: creditInfo.remaining,
        can_send: creditInfo.can_send,
        cycle_reset: creditInfo.cycle_reset,
        total_tokens: billing?.total_tokens_used || 0,
        total_cost_usd: billing?.total_cost_usd || 0,
        billing_cycle_start: billing?.billing_cycle_start || null,
        billing_cycle_end: billing?.billing_cycle_end || null,
        generation_count_this_month: generationCount || 0,
        has_stripe: !!billing?.stripe_customer_id,
        v0_rate_limits: v0Billing,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[v0-usage] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
