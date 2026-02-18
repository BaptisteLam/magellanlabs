import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { oldSubdomain, newSubdomain, sessionId } = await req.json();

    if (!newSubdomain || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing newSubdomain or sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return new Response(
        JSON.stringify({ error: 'Cloudflare configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the old KV value to copy to new key
    let kvValue = newSubdomain;
    if (oldSubdomain) {
      try {
        const getResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${oldSubdomain}`,
          { headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } }
        );
        if (getResp.ok) {
          kvValue = await getResp.text();
        }
      } catch {
        // Use newSubdomain as fallback
      }

      // Delete old KV entry
      try {
        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${oldSubdomain}`,
          { method: 'DELETE', headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } }
        );
      } catch {
        // Ignore delete errors
      }
    }

    // Write new KV entry
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${newSubdomain}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
        body: kvValue,
      }
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
