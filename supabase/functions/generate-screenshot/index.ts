import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Try to authenticate with the token (could be user JWT or service role key)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client to verify the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to get user from token (will work for both user JWT and service key)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    // If auth fails, check if it's a service role key call
    let supabaseClient;
    if (authError && token !== supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use admin client if it's a service key call, otherwise create user client
    supabaseClient = supabaseAdmin;

    const { url, sessionId, websiteId } = await req.json();

    if (!url && !sessionId && !websiteId) {
      return new Response(
        JSON.stringify({ error: 'URL, sessionId or websiteId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-screenshot] Generating for: ${url || sessionId || websiteId}`);

    const APIFLASH_ACCESS_KEY = Deno.env.get('APIFLASH_ACCESS_KEY');
    if (!APIFLASH_ACCESS_KEY) {
      throw new Error('APIFLASH_ACCESS_KEY not configured');
    }

    // Construire l'URL de screenshot
    const screenshotUrl = new URL('https://api.apiflash.com/v1/urltoimage');
    screenshotUrl.searchParams.set('access_key', APIFLASH_ACCESS_KEY);
    screenshotUrl.searchParams.set('url', url || 'https://example.com');
    screenshotUrl.searchParams.set('format', 'webp');
    screenshotUrl.searchParams.set('width', '800');
    screenshotUrl.searchParams.set('height', '600');
    screenshotUrl.searchParams.set('delay', '2');

    // Télécharger le screenshot
    const screenshotResponse = await fetch(screenshotUrl.toString());
    if (!screenshotResponse.ok) {
      throw new Error(`Failed to generate screenshot: ${screenshotResponse.status}`);
    }

    const screenshotBlob = await screenshotResponse.blob();
    const screenshotBuffer = await screenshotBlob.arrayBuffer();

    // Supprimer l'ancien screenshot s'il existe
    if (sessionId) {
      const { data: existingSession } = await supabaseClient
        .from('build_sessions')
        .select('thumbnail_url')
        .eq('id', sessionId)
        .single();
      
      if (existingSession?.thumbnail_url) {
        const oldFileName = existingSession.thumbnail_url.split('/').pop();
        if (oldFileName) {
          await supabaseClient.storage.from('screenshots').remove([oldFileName]);
        }
      }
    } else if (websiteId) {
      const { data: existingWebsite } = await supabaseClient
        .from('websites')
        .select('thumbnail_url')
        .eq('id', websiteId)
        .single();
      
      if (existingWebsite?.thumbnail_url) {
        const oldFileName = existingWebsite.thumbnail_url.split('/').pop();
        if (oldFileName) {
          await supabaseClient.storage.from('screenshots').remove([oldFileName]);
        }
      }
    }

    // Uploader vers Supabase Storage
    const fileName = `${sessionId || websiteId || 'screenshot'}_${Date.now()}.webp`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('screenshots')
      .upload(fileName, screenshotBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
    }

    // Obtenir l'URL publique
    const { data: publicUrlData } = supabaseClient.storage
      .from('screenshots')
      .getPublicUrl(fileName);

    const thumbnailUrl = publicUrlData.publicUrl;

    // Mettre à jour la table build_sessions ou websites
    if (sessionId) {
      await supabaseClient
        .from('build_sessions')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', sessionId);
      
      // Also update the corresponding website entry if it exists (for published sites)
      const { data: session } = await supabaseClient
        .from('build_sessions')
        .select('title, user_id')
        .eq('id', sessionId)
        .single();
      
      if (session) {
        const { data: website } = await supabaseClient
          .from('websites')
          .select('id')
          .eq('user_id', session.user_id)
          .eq('title', session.title)
          .maybeSingle();
        
        if (website) {
          await supabaseClient
            .from('websites')
            .update({ thumbnail_url: thumbnailUrl })
            .eq('id', website.id);
          console.log(`[generate-screenshot] ✅ Website thumbnail also updated`);
        }
      }
    } else if (websiteId) {
      await supabaseClient
        .from('websites')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', websiteId);
    }

    console.log(`[generate-screenshot] ✅ Screenshot saved: ${thumbnailUrl}`);

    return new Response(
      JSON.stringify({ thumbnailUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-screenshot] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
