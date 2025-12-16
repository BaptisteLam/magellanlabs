import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloudflareVersion {
  id: string;
  number: number;
  metadata: {
    created_on: string;
    modified_on: string;
    author_email?: string;
  };
  resources?: {
    script?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    
    // GET: List versions
    if (req.method === 'GET') {
      const sessionId = url.searchParams.get('sessionId');
      
      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'sessionId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user owns this session
      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const workerName = `magellan-${sessionId}`;
      console.log('📜 Fetching versions for:', workerName);

      // Get Worker versions from Cloudflare
      const versionsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}/versions`,
        {
          headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
        }
      );

      if (!versionsResponse.ok) {
        // Worker might not exist yet
        if (versionsResponse.status === 404) {
          return new Response(JSON.stringify({ versions: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const errorData = await versionsResponse.json();
        console.error('❌ Failed to fetch versions:', errorData);
        return new Response(JSON.stringify({ error: 'Failed to fetch versions', details: errorData }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const versionsData = await versionsResponse.json();
      
      // Transform Cloudflare versions to our format
      const versions = (versionsData.result || []).map((v: CloudflareVersion, index: number) => ({
        id: v.id,
        number: v.number,
        timestamp: new Date(v.metadata?.created_on || Date.now()).getTime(),
        message: `Version ${v.number}`,
        isCurrent: index === 0,
      }));

      console.log('✅ Found', versions.length, 'versions');

      return new Response(JSON.stringify({ versions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Rollback to version
    if (req.method === 'POST') {
      const { sessionId, versionId } = await req.json();

      if (!sessionId || !versionId) {
        return new Response(JSON.stringify({ error: 'sessionId and versionId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user owns this session
      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const workerName = `magellan-${sessionId}`;
      console.log('🔄 Rolling back', workerName, 'to version:', versionId);

      // Deploy the specific version
      const rollbackResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}/deployments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            strategy: 'percentage',
            versions: [
              { version_id: versionId, percentage: 100 }
            ],
          }),
        }
      );

      if (!rollbackResponse.ok) {
        const errorData = await rollbackResponse.json();
        console.error('❌ Rollback failed:', errorData);
        return new Response(JSON.stringify({ error: 'Failed to rollback', details: errorData }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rollbackData = await rollbackResponse.json();
      console.log('✅ Rollback successful');

      // Note: We can't easily get the files from the Worker version
      // The frontend will need to refresh from the preview URL

      return new Response(JSON.stringify({
        success: true,
        versionId,
        deployment: rollbackData.result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
