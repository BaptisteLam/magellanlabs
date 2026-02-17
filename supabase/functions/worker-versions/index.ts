import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * worker-versions Edge Function
 *
 * GET  ?sessionId=xxx  → List versions for a session (from build_sessions history)
 * POST { sessionId, versionId } → Rollback to a specific version
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'sessionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch generations for this session as "versions"
      const { data: generations, error } = await supabase
        .from('generations')
        .select('id, prompt, created_at, status')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[worker-versions] Error fetching versions:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch versions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const versions = (generations || []).map((gen, index) => ({
        id: gen.id,
        number: (generations?.length || 0) - index,
        timestamp: new Date(gen.created_at).getTime(),
        message: gen.prompt?.substring(0, 100) || `Version ${(generations?.length || 0) - index}`,
        isCurrent: index === 0,
      }));

      return new Response(
        JSON.stringify({ versions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const { sessionId, versionId } = await req.json();

      if (!sessionId || !versionId) {
        return new Response(
          JSON.stringify({ error: 'sessionId and versionId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the generation's code for this version
      const { data: generation, error: genError } = await supabase
        .from('generations')
        .select('code')
        .eq('id', versionId)
        .eq('user_id', user.id)
        .single();

      if (genError || !generation) {
        return new Response(
          JSON.stringify({ error: 'Version not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Restore project_files from this version
      let projectFiles = {};
      try {
        projectFiles = typeof generation.code === 'string'
          ? JSON.parse(generation.code)
          : generation.code;
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid version data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update build session with restored files
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { error: updateError } = await supabaseAdmin
        .from('build_sessions')
        .update({
          project_files: projectFiles,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('[worker-versions] Error restoring version:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to restore version' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, files: projectFiles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[worker-versions] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
