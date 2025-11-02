import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, htmlContent, table } = await req.json();

    if (!projectId || !htmlContent || !table) {
      throw new Error('Missing required fields: projectId, htmlContent, or table');
    }

    console.log(`Generating screenshot for project ${projectId}`);

    // Use APIFlash to generate real screenshot
    const apiflashKey = Deno.env.get('APIFLASH_ACCESS_KEY');
    
    if (!apiflashKey) {
      throw new Error('APIFLASH_ACCESS_KEY environment variable is required');
    }

    console.log('Generating real screenshot from HTML...');
    
    // Create URL with parameters for APIFlash
    const params = new URLSearchParams({
      access_key: apiflashKey,
      html: htmlContent,
      wait_until: 'page_loaded',
      width: '1200',
      height: '630',
      format: 'png',
      response_type: 'image',
    });

    const screenshotResponse = await fetch(`https://api.apiflash.com/v1/urltoimage?${params.toString()}`);

    if (!screenshotResponse.ok) {
      const errorText = await screenshotResponse.text();
      throw new Error(`Screenshot API failed: ${screenshotResponse.statusText} - ${errorText}`);
    }

    console.log('Screenshot generated, preparing upload...');
    const imageBuffer = new Uint8Array(await screenshotResponse.arrayBuffer());
    
    console.log('Screenshot generated, uploading to storage...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload to Supabase Storage
    const fileName = `${projectId}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    console.log('Screenshot uploaded successfully');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);

    const thumbnailUrl = urlData.publicUrl;

    // Update the project with thumbnail URL
    const { error: updateError } = await supabase
      .from(table)
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', projectId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log(`Screenshot generated and saved for project ${projectId}`);

    return new Response(
      JSON.stringify({ success: true, thumbnailUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating screenshot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});