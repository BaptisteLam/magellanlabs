import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * stripe-checkout Edge Function
 *
 * Creates a Stripe Checkout Session for premium plan subscriptions.
 * Uses Product IDs (STRIPE_PRODUCT_MONTHLY, STRIPE_PRODUCT_ANNUAL)
 * and automatically looks up the active price for each product.
 *
 * POST /stripe-checkout
 * Body: { priceType: 'monthly' | 'annual', successUrl?: string, cancelUrl?: string }
 * Returns: { url: string } (Stripe Checkout URL)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Validate Stripe config ----
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_PRODUCT_MONTHLY = Deno.env.get('STRIPE_PRODUCT_MONTHLY');
    const STRIPE_PRODUCT_ANNUAL = Deno.env.get('STRIPE_PRODUCT_ANNUAL');

    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!STRIPE_PRODUCT_MONTHLY || !STRIPE_PRODUCT_ANNUAL) {
      return new Response(
        JSON.stringify({ error: 'Stripe products not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Auth ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Parse body ----
    const { priceType, successUrl, cancelUrl } = await req.json();

    if (!priceType || !['monthly', 'annual'].includes(priceType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid priceType. Must be "monthly" or "annual".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const productId = priceType === 'monthly' ? STRIPE_PRODUCT_MONTHLY : STRIPE_PRODUCT_ANNUAL;

    // ---- Initialize Stripe ----
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ---- Look up the active price for this product ----
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });

    if (prices.data.length === 0) {
      console.error(`❌ No active price found for product ${productId}`);
      return new Response(
        JSON.stringify({ error: 'No active price found for this plan.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priceId = prices.data[0].id;
    console.log(`💰 Using price ${priceId} for product ${productId} (${priceType})`);

    // ---- Check if user already has a Stripe customer ----
    const { data: billing } = await supabaseAdmin
      .from('billing')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = billing?.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Save customer ID to billing table (upsert in case row doesn't exist)
      if (billing) {
        await supabaseAdmin
          .from('billing')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id);
      } else {
        await supabaseAdmin
          .from('billing')
          .insert({
            user_id: user.id,
            stripe_customer_id: customerId,
            plan: 'free',
            messages_limit: 5,
            messages_used_this_month: 0,
          });
      }
    }

    // ---- Check if user already has an active subscription ----
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      // User already has an active subscription - create a portal session instead
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: successUrl || `${req.headers.get('origin')}/pricing`,
      });

      return new Response(
        JSON.stringify({ url: portalSession.url, type: 'portal' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Create Checkout Session ----
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.get('origin')}/pricing?success=true`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/pricing?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        price_type: priceType,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          price_type: priceType,
        },
      },
    });

    console.log(`✅ Checkout session created for user ${user.id}: ${session.id}`);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ stripe-checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while creating the checkout session.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
