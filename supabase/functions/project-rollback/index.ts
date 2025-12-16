import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, versionId } = await req.json();

    if (!sessionId || !versionId) {
      return new Response(JSON.stringify({ error: 'sessionId and versionId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Rollback request:', sessionId, 'to version', versionId);

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

    // ===== PHASE 1: Fetch version from R2 =====
    const versionPath = `projects/${sessionId}/versions/${versionId}.json`;
    console.log('📦 Fetching version from R2:', versionPath);

    const versionResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(versionPath)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!versionResponse.ok) {
      console.error('❌ Version not found in R2');
      return new Response(JSON.stringify({ error: 'Version not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const versionData = await versionResponse.json();
    const restoredFiles = versionData.files as Record<string, string>;
    console.log('✅ Version loaded:', Object.keys(restoredFiles).length, 'files');

    // ===== PHASE 2: Restore files to KV (real-time preview) =====
    console.log('📤 Restoring files to KV...');
    
    const kvPromises = Object.entries(restoredFiles).map(async ([path, content]) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const kvKey = `${sessionId}:${normalizedPath}`;

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(kvKey)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: content,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to restore ${path} to KV`);
      }

      return { path, success: true };
    });

    await Promise.all(kvPromises);
    console.log('✅ KV restored');

    // ===== PHASE 3: Update Supabase build_sessions =====
    console.log('💾 Updating Supabase...');
    
    const { error: updateError } = await supabase
      .from('build_sessions')
      .update({ 
        project_files: restoredFiles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Supabase update failed:', updateError);
    } else {
      console.log('✅ Supabase updated');
    }

    // ===== PHASE 4: Create rollback version in R2 =====
    const newVersionId = `v${Date.now()}`;
    const rollbackMessage = `Rollback vers ${versionId}`;
    
    const newVersionData = {
      id: newVersionId,
      timestamp: Date.now(),
      message: rollbackMessage,
      files: restoredFiles,
      filesCount: Object.keys(restoredFiles).length,
    };

    const newVersionPath = `projects/${sessionId}/versions/${newVersionId}.json`;
    
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(newVersionPath)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newVersionData),
      }
    );

    // Update metadata
    const metadataPath = `projects/${sessionId}/metadata.json`;
    let metadata = { versions: [] as any[], lastUpdated: Date.now() };

    try {
      const metaResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(metadataPath)}`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
        }
      );
      if (metaResponse.ok) {
        metadata = await metaResponse.json();
      }
    } catch (e) {}

    metadata.versions.unshift({
      id: newVersionId,
      timestamp: Date.now(),
      message: rollbackMessage,
      filesCount: Object.keys(restoredFiles).length,
    });
    metadata.lastUpdated = Date.now();

    // Limit versions to 10
    if (metadata.versions.length > 10) {
      metadata.versions = metadata.versions.slice(0, 10);
    }

    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(metadataPath)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );

    console.log('✅ Rollback complete:', newVersionId);

    return new Response(JSON.stringify({
      success: true,
      restoredVersion: versionId,
      newVersionId,
      files: restoredFiles,
      filesCount: Object.keys(restoredFiles).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Rollback error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
