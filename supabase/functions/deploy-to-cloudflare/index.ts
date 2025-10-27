import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template HTML par défaut
const DEFAULT_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Site créé avec Trinity 🚀</title>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>
    <h1>Bienvenue sur votre site Trinity 🚀</h1>
    <script src="./script.js"></script>
  </body>
</html>`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectFiles, title } = await req.json();
    
    // Valider que projectFiles est un objet JSON valide
    if (!projectFiles || typeof projectFiles !== "object") {
      throw new Error("projectFiles JSON invalide");
    }
    
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

    // Créer un ZIP avec tous les fichiers du projet
    const zip = new JSZip();
    for (const [path, content] of Object.entries(projectFiles)) {
      zip.file(path, content as string);
    }

    // Générer le ZIP en tant qu'ArrayBuffer
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    console.log(`ZIP created with ${Object.keys(projectFiles).length} files, size: ${zipArrayBuffer.byteLength} bytes`);

    // Créer le manifest automatiquement pour tous les fichiers
    const manifestEntries: Record<string, { path: string }> = {};
    for (const path of Object.keys(projectFiles)) {
      manifestEntries[path] = { path };
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

    // Sauvegarder dans la base de données avec le JSON complet
    const { data: website, error: insertError } = await supabase
      .from('websites')
      .insert({
        user_id: user.id,
        title: title || 'Mon site web',
        html_content: JSON.stringify(projectFiles), // Enregistrer le JSON complet des fichiers
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
