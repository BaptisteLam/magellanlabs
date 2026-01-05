import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Vercel credentials
    const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN');
    const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID');

    if (!VERCEL_API_TOKEN) {
      return new Response(JSON.stringify({ error: 'VERCEL_API_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { deploymentId } = await req.json();

    if (!deploymentId) {
      return new Response(JSON.stringify({ error: 'Missing deploymentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check deployment status
    const statusUrl = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${VERCEL_TEAM_ID}`
      : `https://api.vercel.com/v13/deployments/${deploymentId}`;

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Vercel API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to check deployment status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deployment = await response.json();
    
    // Map Vercel readyState to our status
    const statusMap: Record<string, string> = {
      'QUEUED': 'QUEUED',
      'BUILDING': 'BUILDING',
      'READY': 'READY',
      'ERROR': 'ERROR',
      'CANCELED': 'CANCELED',
    };

    const status = statusMap[deployment.readyState] || 'BUILDING';

    console.log(`📊 Deployment ${deploymentId}: ${status}`);

    return new Response(
      JSON.stringify({
        status,
        url: deployment.url ? `https://${deployment.url}` : null,
        readyState: deployment.readyState,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ check-vercel-deployment error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
