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

    // Use APIFlash to generate screenshot from HTML
    const apiflashKey = Deno.env.get('APIFLASH_ACCESS_KEY');
    
    if (!apiflashKey) {
      throw new Error('APIFLASH_ACCESS_KEY environment variable is required');
    }

    console.log('Generating screenshot from HTML...');
    
    // Clean HTML content
    let cleanHtml = htmlContent.trim();
    if (cleanHtml.startsWith('```html')) {
      cleanHtml = cleanHtml.replace(/^```html\n/, '').replace(/\n```$/, '');
    } else if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Ensure HTML has proper structure
    if (!cleanHtml.toLowerCase().includes('<!doctype')) {
      cleanHtml = `<!DOCTYPE html>\n${cleanHtml}`;
    }
    
    // Use APIFlash HTML parameter
    const apiflashUrl = new URL('https://api.apiflash.com/v1/urltoimage');
    apiflashUrl.searchParams.set('access_key', apiflashKey);
    apiflashUrl.searchParams.set('wait_until', 'page_loaded');
    apiflashUrl.searchParams.set('width', '1200');
    apiflashUrl.searchParams.set('height', '630');
    apiflashUrl.searchParams.set('format', 'png');
    apiflashUrl.searchParams.set('response_type', 'image');

    const screenshotResponse = await fetch(apiflashUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/html',
      },
      body: cleanHtml
    });

    if (!screenshotResponse.ok) {
      const errorText = await screenshotResponse.text();
      console.error('APIFlash error:', errorText);
      throw new Error(`Screenshot API failed: ${screenshotResponse.statusText} - ${errorText}`);
    }

    console.log('Screenshot generated, preparing upload...');
    const imageBuffer = new Uint8Array(await screenshotResponse.arrayBuffer());
    
    console.log('Screenshot generated, uploading to storage...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete old screenshot if it exists
    const fileName = `${projectId}.png`;
    console.log('Checking for existing screenshot...');
    const { data: existingFiles } = await supabase.storage
      .from('screenshots')
      .list('', { search: fileName });

    if (existingFiles && existingFiles.length > 0) {
      console.log('Deleting old screenshot...');
      await supabase.storage
        .from('screenshots')
        .remove([fileName]);
    }

    // Upload new screenshot to Supabase Storage
    console.log('Uploading new screenshot...');
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

    // Get public URL with cache busting
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);

    const thumbnailUrl = `${urlData.publicUrl}?t=${Date.now()}`;

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