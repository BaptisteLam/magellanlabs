import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

/**
 * stripe-webhook Edge Function
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed → Activate premium plan
 * - customer.subscription.updated → Update plan/limits
 * - customer.subscription.deleted → Downgrade to free
 * - invoice.payment_failed → Mark payment issue
 *
 * POST /stripe-webhook (called by Stripe, no auth header)
 */
serve(async (req) => {
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('❌ Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return new Response('Webhook not configured', { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // ---- Verify webhook signature ----
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`📨 Received Stripe event: ${event.type}`);

    // ---- Handle events ----
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.error('❌ No supabase_user_id in session metadata');
          break;
        }

        console.log(`✅ Checkout completed for user ${userId}, subscription: ${subscriptionId}`);

        // Activate premium plan
        const now = new Date();
        const cycleEnd = new Date(now);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

        const { error } = await supabaseAdmin
          .from('billing')
          .update({
            plan: 'premium',
            messages_limit: 50,
            messages_used_this_month: 0,
            stripe_subscription_id: subscriptionId,
            billing_cycle_start: now.toISOString(),
            billing_cycle_end: cycleEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId);

        if (error) {
          console.error('❌ Failed to update billing:', error);
        } else {
          console.log(`✅ User ${userId} upgraded to premium`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        const status = subscription.status;
        console.log(`🔄 Subscription updated for user ${userId}: ${status}`);

        if (status === 'active') {
          await supabaseAdmin
            .from('billing')
            .update({
              plan: 'premium',
              messages_limit: 50,
              stripe_subscription_id: subscription.id,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
        } else if (status === 'past_due' || status === 'unpaid') {
          // Keep premium for now but mark the issue
          console.warn(`⚠️ Subscription ${status} for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        console.log(`❌ Subscription canceled for user ${userId}`);

        // Downgrade to free
        await supabaseAdmin
          .from('billing')
          .update({
            plan: 'free',
            messages_limit: 5,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log(`✅ User ${userId} downgraded to free`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = sub.metadata?.supabase_user_id;

          if (userId) {
            console.warn(`💳 Payment failed for user ${userId}`);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ stripe-webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
