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

    // Use HTML to Image API to generate real screenshot
    const hctiUserId = Deno.env.get('HCTI_USER_ID');
    const hctiApiKey = Deno.env.get('HCTI_API_KEY');
    
    if (!hctiUserId || !hctiApiKey) {
      throw new Error('HCTI_USER_ID and HCTI_API_KEY environment variables are required');
    }

    console.log('Generating real screenshot from HTML...');
    const screenshotResponse = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${hctiUserId}:${hctiApiKey}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        viewport_width: 1200,
        viewport_height: 630,
        device_scale: 1,
      })
    });

    if (!screenshotResponse.ok) {
      const errorText = await screenshotResponse.text();
      throw new Error(`Screenshot API failed: ${screenshotResponse.statusText} - ${errorText}`);
    }

    const screenshotData = await screenshotResponse.json();
    const imageUrl = screenshotData.url;
    
    if (!imageUrl) {
      throw new Error('No screenshot URL returned');
    }

    console.log('Downloading screenshot image...');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download screenshot');
    }

    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
    
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