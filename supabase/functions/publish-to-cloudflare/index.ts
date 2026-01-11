import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Préparer les fichiers pour le déploiement
function prepareDeployFiles(files: Record<string, string>): Record<string, string> {
  const deployFiles: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    // Normaliser le chemin (supprimer le / initial si présent)
    let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Ignorer les fichiers de config React/Vite
    const skipFiles = ['package.json', 'vite.config.ts', 'tsconfig.json', 'node_modules'];
    if (skipFiles.some(skip => normalizedPath.includes(skip))) continue;
    
    deployFiles[normalizedPath] = content;
  }

  // S'assurer qu'on a un index.html à la racine
  if (!deployFiles['index.html']) {
    const indexLocations = ['public/index.html', 'src/index.html', 'dist/index.html'];
    for (const loc of indexLocations) {
      if (deployFiles[loc]) {
        deployFiles['index.html'] = deployFiles[loc];
        break;
      }
    }
  }

  // Ajouter un _redirects pour SPA routing
  if (!deployFiles['_redirects']) {
    deployFiles['_redirects'] = '/*    /index.html   200';
  }

  return deployFiles;
}

// Encoder le contenu en base64
function toBase64(content: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return btoa(String.fromCharCode(...data));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Cloudflare credentials
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { sessionId, projectFiles } = await req.json();

    if (!sessionId || !projectFiles) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or projectFiles' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('id, user_id, cloudflare_project_name, title')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📦 Preparing files for Cloudflare Pages deployment...');
    const deployFiles = prepareDeployFiles(projectFiles);
    console.log(`📁 ${Object.keys(deployFiles).length} files prepared`);

    let projectName = session.cloudflare_project_name;

    // Créer un nouveau projet Cloudflare Pages si nécessaire
    if (!projectName) {
      console.log('🆕 Creating new Cloudflare Pages project...');
      
      // Générer un nom de projet unique
      const safeName = (session.title || 'magellan-site')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30);
      
      projectName = `${safeName}-${sessionId.substring(0, 8)}`;

      const createProjectResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: 'main',
          }),
        }
      );

      const createResult = await createProjectResponse.json();
      
      if (!createResult.success) {
        // Si le projet existe déjà, on continue
        if (createResult.errors?.[0]?.code !== 8000007) {
          console.error('❌ Failed to create Cloudflare Pages project:', createResult.errors);
          return new Response(JSON.stringify({ 
            error: 'Failed to create Cloudflare Pages project',
            details: createResult.errors 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log('ℹ️ Project already exists, continuing...');
      } else {
        console.log('✅ Cloudflare Pages project created:', projectName);
      }

      // Sauvegarder le nom du projet
      await supabase
        .from('build_sessions')
        .update({ cloudflare_project_name: projectName })
        .eq('id', sessionId);
    }

    // Créer le déploiement avec Direct Upload
    console.log('📤 Creating deployment with Direct Upload...');

    // Préparer le FormData avec les fichiers
    const formData = new FormData();
    
    // Ajouter chaque fichier au manifest
    const manifest: Record<string, string> = {};
    
    for (const [path, content] of Object.entries(deployFiles)) {
      // Créer un Blob pour chaque fichier
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append(path, blob, path);
      manifest[`/${path}`] = path;
    }
    
    // Ajouter le manifest
    formData.append('manifest', JSON.stringify(manifest));

    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: formData,
      }
    );

    const deployResult = await deployResponse.json();
    
    if (!deployResult.success) {
      console.error('❌ Failed to create deployment:', deployResult.errors);
      return new Response(JSON.stringify({ 
        error: 'Failed to create deployment',
        details: deployResult.errors 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deployment = deployResult.result;
    console.log('📋 Deployment created:', deployment.id);

    // Attendre que le déploiement soit prêt
    let deployStatus = deployment.latest_stage?.name || 'queued';
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (deployStatus !== 'deploy' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments/${deployment.id}`,
        {
          headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
        }
      );
      
      const statusResult = await statusResponse.json();
      
      if (statusResult.success && statusResult.result) {
        const stage = statusResult.result.latest_stage;
        deployStatus = stage?.name || 'unknown';
        const stageStatus = stage?.status || 'unknown';
        console.log(`⏳ Deploy stage: ${deployStatus} (${stageStatus}) - attempt ${attempts + 1}`);
        
        // Si c'est "deploy" et "success", on a fini
        if (deployStatus === 'deploy' && stageStatus === 'success') {
          break;
        }
        
        // Si erreur, arrêter
        if (stageStatus === 'failure') {
          return new Response(JSON.stringify({ 
            error: 'Deployment failed',
            stage: deployStatus 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      attempts++;
    }

    // Récupérer l'URL finale
    const finalUrl = deployment.url || `https://${projectName}.pages.dev`;
    console.log('✅ Deployment successful:', finalUrl);

    // Mettre à jour la session avec l'URL
    await supabase
      .from('build_sessions')
      .update({ 
        cloudflare_deployment_url: finalUrl,
        public_url: finalUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        url: finalUrl,
        deployId: deployment.id,
        projectName: projectName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ publish-to-cloudflare error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
