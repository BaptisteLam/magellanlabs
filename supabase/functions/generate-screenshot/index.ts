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

    // Use Lovable AI to generate a screenshot from HTML description
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY environment variable is required');
    }

    console.log('Generating screenshot using Lovable AI...');
    
    // Extract key visual information from HTML
    const visualPrompt = `Generate a professional website screenshot preview image (1200x630px) for this HTML page. 
Make it look like a real browser screenshot with modern UI design.

HTML content preview:
${htmlContent.substring(0, 1000)}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: visualPrompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`Lovable AI API failed: ${aiResponse.statusText} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated from AI');
    }

    console.log('Screenshot generated, preparing upload...');
    
    // Convert base64 to buffer
    const base64Data = imageUrl.split(',')[1];
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
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