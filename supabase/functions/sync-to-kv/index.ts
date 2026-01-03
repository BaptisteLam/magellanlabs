import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Nettoie les fichiers des marqueurs markdown résiduels
function sanitizeProjectFiles(files: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    let cleanContent = content;

    // Supprimer les marqueurs markdown au début (```tsx, ```html, etc.)
    cleanContent = cleanContent.replace(/^```[\w]*\s*\n?/gm, '');

    // Supprimer les marqueurs markdown à la fin (```)
    cleanContent = cleanContent.replace(/\n?```\s*$/gm, '');

    // Supprimer les marqueurs isolés
    cleanContent = cleanContent.replace(/^```\s*$/gm, '');

    // Nettoyer les lignes vides excessives
    cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

    cleaned[path] = cleanContent;
  }

  return cleaned;
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
    const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID') || 'e6647451f41d4e0e8e1fc68ac7443b51';

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, projectFiles } = await req.json();

    if (!sessionId || !projectFiles) {
      return new Response(JSON.stringify({ error: 'sessionId and projectFiles required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Syncing to KV for session:', sessionId);
    console.log('📁 Files:', Object.keys(projectFiles).length);

    // Verify user owns this session
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize files before uploading to KV
    const sanitizedFiles = sanitizeProjectFiles(projectFiles);

    // Write each file to Cloudflare KV
    // Using bulk write API for better performance
    const kvWrites: Array<{ key: string; value: string }> = [];

    for (const [path, content] of Object.entries(sanitizedFiles)) {
      // Normalize path: ensure it starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const kvKey = `${sessionId}:${normalizedPath}`;

      kvWrites.push({ key: kvKey, value: content });
    }

    console.log(`📤 Writing ${kvWrites.length} files to KV...`);

    // Cloudflare KV bulk write (max 10,000 keys per request)
    // We'll write files individually for simplicity (can be optimized later)
    let successCount = 0;
    let errorCount = 0;

    for (const { key, value } of kvWrites) {
      try {
        const kvResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'text/plain',
            },
            body: value,
          }
        );

        if (kvResponse.ok) {
          successCount++;
        } else {
          const errorData = await kvResponse.json();
          console.error(`❌ KV write error for ${key}:`, errorData);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ KV write exception for ${key}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ KV sync complete: ${successCount} success, ${errorCount} errors`);

    if (successCount === 0) {
      return new Response(JSON.stringify({
        error: 'Failed to write any files to KV',
        details: `${errorCount} errors occurred`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const previewUrl = `https://${sessionId}.builtbymagellan.com`;

    // Update build_sessions with sync info
    await supabase
      .from('build_sessions')
      .update({
        project_files: projectFiles,
        public_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    console.log('✅ Sync complete:', previewUrl);

    return new Response(JSON.stringify({
      success: true,
      previewUrl,
      filesCount: successCount,
      errors: errorCount,
      versionId: `kv-${Date.now()}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Sync error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
