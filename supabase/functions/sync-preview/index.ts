import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { sessionId, projectFiles } = await req.json();

    if (!sessionId || !projectFiles) {
      return new Response(JSON.stringify({ error: 'sessionId and projectFiles required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Sync preview for session:', sessionId);
    console.log('📁 Files to sync:', Object.keys(projectFiles).length);

    // Get Cloudflare credentials
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      console.error('❌ Missing Cloudflare credentials');
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload each file to KV with pattern: {sessionId}:{path}
    const uploadPromises = Object.entries(projectFiles).map(async ([path, content]) => {
      // Normalize path to always start with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const kvKey = `${sessionId}:${normalizedPath}`;
      
      console.log(`  📤 Uploading: ${kvKey}`);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(kvKey)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: content as string,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to upload ${path}:`, errorText);
        throw new Error(`Failed to upload ${path}: ${errorText}`);
      }

      return { path, success: true };
    });

    // Wait for all uploads
    const results = await Promise.all(uploadPromises);
    console.log('✅ All files synced:', results.length);

    // Build the preview URL
    const previewUrl = `https://${sessionId}.builtbymagellan.com`;

    return new Response(JSON.stringify({
      success: true,
      previewUrl,
      filesUploaded: results.length,
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
