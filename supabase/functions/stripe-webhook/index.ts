import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

/**
 * Stripe Webhook Handler
 *
 * Handles Stripe events to activate/deactivate subscriptions in the database.
 * Events handled:
 * - checkout.session.completed: Activate premium plan after successful payment
 * - customer.subscription.deleted: Downgrade to free plan on cancellation
 * - customer.subscription.updated: Handle plan changes
 * - invoice.payment_failed: Handle failed recurring payments
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Verify webhook signature if secret is configured
    let event: any;

    if (STRIPE_WEBHOOK_SECRET && signature) {
      // Manual HMAC verification for Stripe webhook signature
      const crypto = globalThis.crypto;
      const encoder = new TextEncoder();

      const signatureParts = signature.split(',');
      const timestamp = signatureParts.find((p: string) => p.startsWith('t='))?.split('=')[1];
      const sig = signatureParts.find((p: string) => p.startsWith('v1='))?.split('=')[1];

      if (!timestamp || !sig) {
        console.error('Invalid Stripe signature format');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payload = `${timestamp}.${body}`;
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(STRIPE_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const expectedSig = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (expectedSig !== sig) {
        console.error('Stripe signature verification failed');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      event = JSON.parse(body);
    } else {
      // No webhook secret configured - parse body directly (dev mode)
      console.warn('STRIPE_WEBHOOK_SECRET not configured - skipping signature verification');
      event = JSON.parse(body);
    }

    console.log(`Stripe webhook received: ${event.type}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.subscription_data?.metadata?.supabase_user_id;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        if (!userId) {
          console.error('No user ID found in checkout session');
          break;
        }

        console.log(`Activating premium for user ${userId}`);

        // Update user profile to premium
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan: 'premium',
            messages_limit: 50,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to activate premium:', updateError);
        } else {
          console.log(`Premium activated for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        // Find user by stripe customer ID
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();

        if (profile) {
          console.log(`Deactivating premium for user ${profile.id}`);
          await supabaseAdmin
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              messages_limit: 5,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const status = subscription.status;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();

        if (profile) {
          if (status === 'active') {
            await supabaseAdmin
              .from('profiles')
              .update({
                plan: 'premium',
                stripe_subscription_id: subscription.id,
                messages_limit: 50,
                updated_at: new Date().toISOString(),
              })
              .eq('id', profile.id);
          } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
            await supabaseAdmin
              .from('profiles')
              .update({
                plan: 'free',
                messages_limit: 5,
                updated_at: new Date().toISOString(),
              })
              .eq('id', profile.id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();

        if (profile) {
          console.log(`Payment failed for user ${profile.id}`);
          // Don't immediately downgrade - Stripe will retry.
          // Only log for now; subscription.deleted handles final downgrade.
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
