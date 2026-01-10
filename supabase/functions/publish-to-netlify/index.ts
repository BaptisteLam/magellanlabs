import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Créer un fichier ZIP des fichiers du projet
async function createDeployFiles(files: Record<string, string>): Promise<Record<string, string>> {
  const deployFiles: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    // Normaliser le chemin (supprimer le / initial si présent)
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    deployFiles[normalizedPath] = content;
  }

  // S'assurer qu'on a un index.html à la racine
  if (!deployFiles['index.html']) {
    // Chercher index.html dans d'autres emplacements
    const indexLocations = ['public/index.html', 'src/index.html', 'dist/index.html'];
    for (const loc of indexLocations) {
      if (deployFiles[loc]) {
        deployFiles['index.html'] = deployFiles[loc];
        break;
      }
    }
  }

  // Ajouter un _redirects pour SPA
  if (!deployFiles['_redirects']) {
    deployFiles['_redirects'] = '/*    /index.html   200';
  }

  return deployFiles;
}

// Calculer le hash SHA1 d'un contenu
async function sha1(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Get Netlify token
    const NETLIFY_TOKEN = Deno.env.get('NETLIFY_TOKEN');
    if (!NETLIFY_TOKEN) {
      return new Response(JSON.stringify({ error: 'NETLIFY_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { sessionId, projectFiles, siteName } = await req.json();

    if (!sessionId || !projectFiles) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or projectFiles' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('id, user_id, netlify_site_id, title')
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

    console.log('📦 Preparing files for Netlify deployment...');
    const deployFiles = await createDeployFiles(projectFiles);
    console.log(`📁 ${Object.keys(deployFiles).length} files prepared`);

    let netlifysSiteId = session.netlify_site_id;

    // Créer un nouveau site Netlify si nécessaire
    if (!netlifysSiteId) {
      console.log('🆕 Creating new Netlify site...');
      
      // Générer un nom de site unique
      const safeName = (siteName || session.title || 'magellan-site')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      
      const uniqueName = `${safeName}-${sessionId.substring(0, 8)}`;

      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: uniqueName,
          custom_domain: null,
        }),
      });

      if (!createSiteResponse.ok) {
        const errorText = await createSiteResponse.text();
        console.error('❌ Failed to create Netlify site:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to create Netlify site' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newSite = await createSiteResponse.json();
      netlifysSiteId = newSite.id;
      console.log('✅ Netlify site created:', newSite.name);

      // Sauvegarder l'ID du site
      await supabase
        .from('build_sessions')
        .update({ netlify_site_id: netlifysSiteId })
        .eq('id', sessionId);
    }

    // Préparer les fichiers pour le déploiement
    console.log('📤 Uploading files to Netlify...');
    
    // Créer un digest des fichiers (hash -> chemin)
    const fileHashes: Record<string, string> = {};
    const fileContents: Record<string, string> = {};
    
    for (const [path, content] of Object.entries(deployFiles)) {
      const hash = await sha1(content);
      fileHashes[`/${path}`] = hash;
      fileContents[hash] = content;
    }

    // Créer le déploiement
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${netlifysSiteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: fileHashes,
        async: false,
      }),
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Failed to create deployment:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to create deployment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deployment = await deployResponse.json();
    console.log('📋 Deployment created:', deployment.id);

    // Uploader les fichiers requis
    const requiredFiles = deployment.required || [];
    console.log(`📤 Uploading ${requiredFiles.length} required files...`);

    for (const hash of requiredFiles) {
      const content = fileContents[hash];
      if (content) {
        const uploadResponse = await fetch(
          `https://api.netlify.com/api/v1/deploys/${deployment.id}/files/${hash}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${NETLIFY_TOKEN}`,
              'Content-Type': 'application/octet-stream',
            },
            body: content,
          }
        );

        if (!uploadResponse.ok) {
          console.warn(`⚠️ Failed to upload file ${hash}`);
        }
      }
    }

    // Attendre que le déploiement soit prêt
    let deployStatus = deployment.state;
    let attempts = 0;
    const maxAttempts = 30;

    while (deployStatus !== 'ready' && deployStatus !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `https://api.netlify.com/api/v1/deploys/${deployment.id}`,
        {
          headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` },
        }
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        deployStatus = statusData.state;
        console.log(`⏳ Deploy status: ${deployStatus} (attempt ${attempts + 1})`);
      }
      
      attempts++;
    }

    if (deployStatus !== 'ready') {
      return new Response(JSON.stringify({ 
        error: 'Deployment timed out or failed',
        status: deployStatus 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer l'URL finale
    const finalUrl = deployment.ssl_url || deployment.url || `https://${deployment.name}.netlify.app`;
    console.log('✅ Deployment successful:', finalUrl);

    // Mettre à jour la session avec l'URL
    await supabase
      .from('build_sessions')
      .update({ 
        netlify_deployment_url: finalUrl,
        public_url: finalUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        url: finalUrl,
        deployId: deployment.id,
        siteId: netlifysSiteId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ publish-to-netlify error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
