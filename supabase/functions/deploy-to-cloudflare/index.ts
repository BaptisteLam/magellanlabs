import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  name: string;
  content: string;
  type: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Créer le client Supabase avec l'en-tête d'autorisation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    const { sessionId, projectFiles } = await req.json();
    
    if (!sessionId || !projectFiles) {
      console.error('❌ Missing sessionId or projectFiles');
      return new Response(
        JSON.stringify({ error: 'Session ID and project files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Deploying project to Cloudflare Pages...');
    console.log('Session ID:', sessionId);
    console.log('Files count:', projectFiles.length);

    // Get session data to check if project already exists
    const { data: session, error: sessionError } = await supabaseClient
      .from('build_sessions')
      .select('cloudflare_project_name, cloudflare_deployment_url, title')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      throw new Error(`Failed to get session: ${sessionError.message}`);
    }

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Generate project name from session title or use default
    const projectName = session.cloudflare_project_name || 
      `trinity-${session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site'}-${sessionId.slice(0, 8)}`;

    console.log('Project name:', projectName);

    // Cloudflare Pages Direct Upload API nécessite un format spécifique
    // 1. D'abord, créer ou obtenir le projet
    const projectUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}`;
    
    console.log('🔍 Checking if project exists...');
    
    const checkProjectResponse = await fetch(projectUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    let projectExists = checkProjectResponse.ok;

    if (!projectExists) {
      console.log('📝 Creating new Cloudflare Pages project...');
      
      const createProjectUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`;
      const createResponse = await fetch(createProjectUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          production_branch: 'main',
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('❌ Failed to create project:', errorText);
        throw new Error(`Failed to create Cloudflare project: ${errorText}`);
      }

      const createResult = await createResponse.json();
      console.log('✅ Project created:', createResult);
      projectExists = true;
    }

    // 2. Préparer les fichiers au format attendu par Cloudflare
    const manifest: Record<string, string> = {};
    projectFiles.forEach((file: ProjectFile, index: number) => {
      // Cloudflare attend les chemins de fichiers sans slash initial
      const filePath = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      manifest[filePath] = file.content;
    });

    // 3. Déployer via Cloudflare Workers KV ou utiliser l'API Direct Upload
    // Pour simplifier, on va créer un déploiement avec les fichiers
    console.log('🚀 Creating deployment...');
    
    const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`;
    
    // Créer un FormData avec les fichiers
    const formData = new FormData();
    
    // Ajouter chaque fichier au FormData
    for (const file of projectFiles) {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      const fileBlob = new Blob([file.content], { type: 'text/plain' });
      formData.append(fileName, fileBlob, fileName);
    }
    
    const deployResponse = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      throw new Error(`Deployment failed: ${errorText}`);
    }

    const deployResult = await deployResponse.json();
    console.log('✅ Deployment result:', deployResult);
    
    const deploymentUrl = deployResult.result?.url || `https://${projectName}.pages.dev`;

    // Update session with Cloudflare info
    const { error: updateError } = await supabaseClient
      .from('build_sessions')
      .update({
        cloudflare_project_name: projectName,
        cloudflare_deployment_url: deploymentUrl,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update session:', updateError);
    }

    console.log('✅ Deployment successful:', deploymentUrl);

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        projectName: projectName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
