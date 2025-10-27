import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction pour extraire CSS et JS du HTML
function extractContent(htmlContent: string) {
  const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  
  const css = styleMatch ? styleMatch[1].trim() : '';
  const js = scriptMatch ? scriptMatch[1].trim() : '';
  
  // Nettoyer le HTML en enlevant les balises style et script inline
  let cleanHtml = htmlContent;
  if (styleMatch) {
    cleanHtml = cleanHtml.replace(styleMatch[0], '<link rel="stylesheet" href="style.css">');
  }
  if (scriptMatch) {
    cleanHtml = cleanHtml.replace(scriptMatch[0], '<script src="script.js"></script>');
  }
  
  return { html: cleanHtml, css, js };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { htmlContent, title } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const cloudflareToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!cloudflareToken || !cloudflareAccountId) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Créer un nom de projet unique
    const projectName = `site-${Date.now()}`;
    
    // Vérifier si le projet existe déjà
    const listProjectsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
        },
      }
    );

    let projectExists = false;
    if (listProjectsResponse.ok) {
      const projectsList = await listProjectsResponse.json();
      projectExists = projectsList.result?.some((p: any) => p.name === projectName) || false;
    }

    // Créer le projet seulement s'il n'existe pas
    if (!projectExists) {
      console.log(`Creating new Cloudflare Pages project: ${projectName}`);
      const createProjectResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: 'main',
          }),
        }
      );

      if (!createProjectResponse.ok) {
        const errorText = await createProjectResponse.text();
        console.error('Cloudflare project creation error:', errorText);
        throw new Error('Failed to create Cloudflare project');
      }
    } else {
      console.log(`Project ${projectName} already exists, creating new deployment`);
    }

    // Extraire HTML, CSS et JS
    const { html, css, js } = extractContent(htmlContent);
    console.log('Extracted content:', { hasHtml: !!html, hasCss: !!css, hasJs: !!js });

    // Créer un fichier ZIP avec JSZip
    const zip = new JSZip();
    zip.file('index.html', html);
    if (css) zip.file('style.css', css);
    if (js) zip.file('script.js', js);

    // Générer le ZIP en tant qu'ArrayBuffer
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    console.log(`ZIP created, size: ${zipArrayBuffer.byteLength} bytes`);

    // Créer le manifest pour Cloudflare avec la liste des fichiers
    const manifestEntries: Record<string, { path: string }> = {
      "index.html": { path: "index.html" }
    };
    
    if (css) {
      manifestEntries["style.css"] = { path: "style.css" };
    }
    
    if (js) {
      manifestEntries["script.js"] = { path: "script.js" };
    }

    // Créer le FormData avec le manifest ET le fichier ZIP
    const formData = new FormData();
    formData.append('manifest', JSON.stringify({ entries: manifestEntries }));
    
    // Ajouter le fichier ZIP
    const zipBlob = new Blob([zipArrayBuffer], { type: 'application/zip' });
    formData.append('file', zipBlob, 'build.zip');

    console.log(`Deploying to Cloudflare Pages project: ${projectName}`);
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
        },
        body: formData,
      }
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('Cloudflare deployment error:', errorText);
      throw new Error(`Failed to deploy to Cloudflare: ${errorText}`);
    }

    const deployData = await deployResponse.json();
    const cloudflareUrl = deployData.result?.url || `https://${projectName}.pages.dev`;
    console.log(`Deployment successful: ${cloudflareUrl}`);

    // Sauvegarder dans la base de données
    const { data: website, error: insertError } = await supabase
      .from('websites')
      .insert({
        user_id: user.id,
        title: title || 'Mon site web',
        html_content: htmlContent,
        cloudflare_url: cloudflareUrl,
        cloudflare_project_name: projectName,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        website,
        url: cloudflareUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in deploy-to-cloudflare:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
