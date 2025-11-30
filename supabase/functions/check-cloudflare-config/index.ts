import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const cloudflareEmail = Deno.env.get('CLOUDFLARE_EMAIL');
    const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');

    if (!cloudflareApiToken || !cloudflareAccountId || !cloudflareEmail || !zoneId) {
      return new Response(
        JSON.stringify({ error: 'Missing Cloudflare credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Vérifier les routes Cloudflare Workers
    console.log('🔍 Checking Cloudflare Workers routes...');
    const routesResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
      {
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
        },
      }
    );

    const routesData = await routesResponse.json();
    console.log('📋 Routes response:', JSON.stringify(routesData, null, 2));

    // 2. Vérifier les DNS records
    console.log('🔍 Checking DNS records...');
    const dnsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
        },
      }
    );

    const dnsData = await dnsResponse.json();
    console.log('📋 DNS records response:', JSON.stringify(dnsData, null, 2));

    // 3. Vérifier un Worker spécifique (premier trouvé)
    console.log('🔍 Listing Workers scripts...');
    const workersResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/workers/scripts`,
      {
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
        },
      }
    );

    const workersData = await workersResponse.json();
    console.log('📋 Workers scripts:', JSON.stringify(workersData, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        routes: routesData,
        dns: dnsData,
        workers: workersData,
        credentials: {
          hasToken: !!cloudflareApiToken,
          hasAccountId: !!cloudflareAccountId,
          hasEmail: !!cloudflareEmail,
          hasZoneId: !!zoneId,
          accountId: cloudflareAccountId,
          zoneId: zoneId
        }
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error checking Cloudflare config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
