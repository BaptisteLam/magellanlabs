import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Stripe signature verification using Web Crypto API
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance = 300
): Promise<boolean> {
  const parts = signature.split(',').reduce((acc: Record<string, string[]>, part) => {
    const [key, value] = part.split('=');
    if (!acc[key]) acc[key] = [];
    acc[key].push(value);
    return acc;
  }, {});

  const timestamp = parts['t']?.[0];
  const signatures = parts['v1'] || [];

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > tolerance) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some(s => s === expectedSig);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();

    // Verify Stripe signature
    const isValid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid Stripe signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);
    console.log(`Stripe webhook received: ${event.type}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event.type) {
      // Payment successful - activate premium
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        if (!userId) {
          console.error('No user ID found in checkout session');
          break;
        }

        console.log(`Activating premium for user ${userId}`);

        // Update billing table
        const { error: billingError } = await supabase
          .from('billing')
          .upsert({
            user_id: userId,
            plan: 'premium',
            messages_limit: 50,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            billing_cycle_start: new Date().toISOString(),
            billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (billingError) {
          console.error('Error updating billing:', billingError);
        } else {
          console.log(`Premium activated for user ${userId}`);
        }

        // Also store stripe_customer_id in profiles for checkout session lookup
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);

        break;
      }

      // Subscription renewed or updated
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        const userId = subscription.metadata?.supabase_user_id;

        // Find user by stripe_customer_id if no userId in metadata
        let targetUserId = userId;
        if (!targetUserId) {
          const { data: billing } = await supabase
            .from('billing')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          targetUserId = billing?.user_id;
        }

        if (!targetUserId) {
          console.error('No user found for customer:', customerId);
          break;
        }

        if (status === 'active') {
          // Subscription is active - ensure premium
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
          const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();

          await supabase
            .from('billing')
            .update({
              plan: 'premium',
              messages_limit: 50,
              stripe_subscription_id: subscription.id,
              billing_cycle_start: currentPeriodStart,
              billing_cycle_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', targetUserId);

          console.log(`Subscription updated for user ${targetUserId}: active until ${currentPeriodEnd}`);
        } else if (status === 'past_due' || status === 'unpaid') {
          console.log(`Subscription ${status} for user ${targetUserId}`);
          // Keep premium for now, Stripe will retry payment
        }

        break;
      }

      // Subscription cancelled or expired
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const userId = subscription.metadata?.supabase_user_id;

        let targetUserId = userId;
        if (!targetUserId) {
          const { data: billing } = await supabase
            .from('billing')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          targetUserId = billing?.user_id;
        }

        if (!targetUserId) {
          console.error('No user found for customer:', customerId);
          break;
        }

        // Downgrade to free
        await supabase
          .from('billing')
          .update({
            plan: 'free',
            messages_limit: 5,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId);

        console.log(`Subscription cancelled for user ${targetUserId} - downgraded to free`);
        break;
      }

      // Invoice paid (for recurring payments)
      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        const { data: billing } = await supabase
          .from('billing')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (billing?.user_id) {
          // Reset monthly message counter on renewal
          await supabase
            .from('billing')
            .update({
              messages_used_this_month: 0,
              billing_cycle_start: new Date().toISOString(),
              billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', billing.user_id);

          console.log(`Invoice paid for user ${billing.user_id} - message counter reset`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook handler failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
