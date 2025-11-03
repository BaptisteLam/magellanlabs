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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    screenshotUrl.searchParams.set('format', 'jpeg');
    screenshotUrl.searchParams.set('width', '1200');
    screenshotUrl.searchParams.set('height', '630');
    screenshotUrl.searchParams.set('quality', '80');
    screenshotUrl.searchParams.set('delay', '2');

    // Télécharger le screenshot
    const screenshotResponse = await fetch(screenshotUrl.toString());
    if (!screenshotResponse.ok) {
      throw new Error(`Failed to generate screenshot: ${screenshotResponse.status}`);
    }

    const screenshotBlob = await screenshotResponse.blob();
    const screenshotBuffer = await screenshotBlob.arrayBuffer();

    // Uploader vers Supabase Storage
    const fileName = `${sessionId || websiteId || 'screenshot'}_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('screenshots')
      .upload(fileName, screenshotBuffer, {
        contentType: 'image/jpeg',
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
