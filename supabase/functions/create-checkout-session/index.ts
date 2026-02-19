import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Price IDs Stripe (configurés en dur + override via secrets)
const PRICE_IDS = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY_ID') || 'price_1T289TRpboNlXCxr2tCpu4d5',
  annual: Deno.env.get('STRIPE_PRICE_ANNUAL_ID') || 'price_1T28C6RpboNlXCxrj3v7CaWm',
} as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Vérifier la clé Stripe
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return new Response(JSON.stringify({
        error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in Supabase secrets.',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Lire le plan demandé
    const { plan } = await req.json();
    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan. Must be "monthly" or "annual".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = PRICE_IDS[plan as 'monthly' | 'annual'];

    // 4. Récupérer ou créer le customer Stripe
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .maybeSingle();

    let stripeCustomerId = profile?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Créer un nouveau customer Stripe
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || profile?.email || '',
          metadata: JSON.stringify({ supabase_user_id: user.id }),
        }),
      });

      const customer = await customerRes.json();

      if (!customerRes.ok) {
        console.error('❌ Failed to create Stripe customer:', customer);
        return new Response(JSON.stringify({ error: 'Failed to create Stripe customer' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      stripeCustomerId = customer.id;

      // Sauvegarder le customer ID en base
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);

      console.log('✅ Stripe customer created:', stripeCustomerId);
    }

    // 5. Créer la session Checkout Stripe
    const successUrl = `${Deno.env.get('SITE_URL') || 'https://magellanlabs.com'}/dashboard?checkout=success`;
    const cancelUrl = `${Deno.env.get('SITE_URL') || 'https://magellanlabs.com'}/tarifs?checkout=cancelled`;

    const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': stripeCustomerId,
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': successUrl,
        'cancel_url': cancelUrl,
        'client_reference_id': user.id,
        'customer_update[address]': 'auto',
        'subscription_data[metadata][supabase_user_id]': user.id,
        'allow_promotion_codes': 'true',
      }),
    });

    const checkoutSession = await checkoutRes.json();

    if (!checkoutRes.ok) {
      console.error('❌ Failed to create Stripe checkout session:', checkoutSession);
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Stripe checkout session created:', checkoutSession.id);

    return new Response(
      JSON.stringify({ url: checkoutSession.url, sessionId: checkoutSession.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error in create-checkout-session:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
