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
    let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    
    const skipFiles = ['package.json', 'vite.config.ts', 'tsconfig.json', 'node_modules'];
    if (skipFiles.some(skip => normalizedPath.includes(skip))) continue;
    
    deployFiles[normalizedPath] = content;
  }

  if (!deployFiles['index.html']) {
    const indexLocations = ['public/index.html', 'src/index.html', 'dist/index.html'];
    for (const loc of indexLocations) {
      if (deployFiles[loc]) {
        deployFiles['index.html'] = deployFiles[loc];
        break;
      }
    }
  }

  if (!deployFiles['_redirects']) {
    deployFiles['_redirects'] = '/*    /index.html   200';
  }

  return deployFiles;
}

// Générer un subdomain unique
function generateSubdomain(title: string): string {
  return (title || 'mon-projet')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

// Vérifier et obtenir un subdomain unique
async function getUniqueSubdomain(
  supabase: any, 
  baseSubdomain: string, 
  sessionId: string
): Promise<string> {
  // Vérifier si ce subdomain existe déjà pour un AUTRE projet
  const { data: existing } = await supabase
    .from('published_projects')
    .select('id, build_session_id, subdomain')
    .eq('subdomain', baseSubdomain)
    .maybeSingle();

  // Si le subdomain appartient à ce projet, on le garde
  if (existing && existing.build_session_id === sessionId) {
    return baseSubdomain;
  }

  // Si le subdomain n'existe pas, on le prend
  if (!existing) {
    return baseSubdomain;
  }

  // Sinon, on ajoute un suffixe numérique
  let suffix = 2;
  let uniqueSubdomain = `${baseSubdomain}-${suffix}`;
  
  while (true) {
    const { data: check } = await supabase
      .from('published_projects')
      .select('id')
      .eq('subdomain', uniqueSubdomain)
      .maybeSingle();
    
    if (!check) {
      return uniqueSubdomain;
    }
    
    suffix++;
    uniqueSubdomain = `${baseSubdomain}-${suffix}`;
    
    // Sécurité: max 100 tentatives
    if (suffix > 100) {
      return `${baseSubdomain}-${Date.now()}`;
    }
  }
}

// Mettre à jour le KV du Worker proxy
async function updateProxyKV(
  subdomain: string,
  cloudflareUrl: string,
  CLOUDFLARE_ACCOUNT_ID: string,
  CLOUDFLARE_API_TOKEN: string,
  CLOUDFLARE_KV_NAMESPACE_ID: string
): Promise<boolean> {
  try {
    console.log(`🔗 Updating proxy KV: ${subdomain} -> ${cloudflareUrl}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${subdomain}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: cloudflareUrl,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to update KV:', errorText);
      return false;
    }

    console.log(`✅ Proxy KV updated: ${subdomain}.builtbymagellan.com -> ${cloudflareUrl}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating proxy KV:', error);
    return false;
  }
}

// Vérifier que le site est accessible
async function verifySiteAccessible(url: string, maxAttempts = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 304) {
        console.log(`✅ Site accessible: ${url}`);
        return true;
      }
    } catch (error) {
      console.log(`⏳ Site not yet accessible, attempt ${i + 1}/${maxAttempts}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
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

    // Service client pour les opérations admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
    const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
    
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { sessionId, projectFiles, siteName, vibePreviewUrl } = await req.json();

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

    // === Vérifier que le plan permet la publication ===
    const { data: billing } = await supabaseAdmin
      .from('billing')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle();

    const userPlan = (billing as any)?.plan || 'free';

    // Free users can publish 1 site; check if they already have a published site for a DIFFERENT session
    if (userPlan === 'free') {
      const { count: publishedCount } = await supabaseAdmin
        .from('build_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('public_url', 'is', null)
        .neq('id', sessionId);

      if ((publishedCount || 0) >= 1) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Free plan allows publishing 1 site. Upgrade to Premium for unlimited publishing.',
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // === SI vibePreviewUrl FOURNI: Utiliser l'URL VibeSDK directement ===
    // VibeSDK déploie déjà l'app React compilée - pas besoin de re-déployer
    if (vibePreviewUrl) {
      console.log('🚀 Using VibeSDK preview URL directly:', vibePreviewUrl);

      // Générer un subdomain unique
      const baseSubdomain = generateSubdomain(siteName || session.title);
      const uniqueSubdomain = await getUniqueSubdomain(supabaseAdmin, baseSubdomain, sessionId);
      const publicUrl = `https://${uniqueSubdomain}.builtbymagellan.com`;

      console.log('🌐 Subdomain:', uniqueSubdomain, '-> Public URL:', publicUrl);

      // Mettre à jour ou créer l'entrée published_projects
      const { data: existingProject } = await supabaseAdmin
        .from('published_projects')
        .select('*')
        .eq('build_session_id', sessionId)
        .maybeSingle();

      if (existingProject) {
        await supabaseAdmin
          .from('published_projects')
          .update({ subdomain: uniqueSubdomain, last_updated: new Date().toISOString() })
          .eq('id', existingProject.id);
      } else {
        await supabaseAdmin
          .from('published_projects')
          .insert({ build_session_id: sessionId, subdomain: uniqueSubdomain });
      }

      // Mapper le subdomain vers l'URL VibeSDK dans le KV proxy
      if (CLOUDFLARE_KV_NAMESPACE_ID) {
        // Stocker directement l'URL VibeSDK dans le KV (pas juste le nom du projet Pages)
        try {
          const kvResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${uniqueSubdomain}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'text/plain',
              },
              body: vibePreviewUrl,
            }
          );
          if (kvResponse.ok) {
            console.log(`✅ KV proxy updated: ${uniqueSubdomain}.builtbymagellan.com -> ${vibePreviewUrl}`);
          }
        } catch (kvErr) {
          console.warn('⚠️ Failed to update KV proxy:', kvErr);
        }
      }

      // Mettre à jour la session
      await supabase
        .from('build_sessions')
        .update({
          cloudflare_deployment_url: vibePreviewUrl,
          public_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      console.log('✅ Publication complete (via VibeSDK URL)!');

      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          cloudflareUrl: vibePreviewUrl,
          subdomain: uniqueSubdomain,
          projectName: uniqueSubdomain,
          isAccessible: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === DÉPLOIEMENT CLOUDFLARE PAGES (fallback pour fichiers statiques) ===
    console.log('📦 Preparing files for Cloudflare Pages deployment...');
    const deployFiles = prepareDeployFiles(projectFiles);
    console.log(`📁 ${Object.keys(deployFiles).length} files prepared`);

    let projectName = session.cloudflare_project_name;

    // Créer un nouveau projet Cloudflare Pages si nécessaire
    if (!projectName) {
      console.log('🆕 Creating new Cloudflare Pages project...');
      
      const safeName = generateSubdomain(siteName || session.title);
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
        if (createResult.errors?.[0]?.code !== 8000007) {
          console.error('❌ Failed to create Cloudflare Pages project:', createResult.errors);
          return new Response(JSON.stringify({
            error: 'Erreur lors de la création du projet. Veuillez réessayer.',
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

    const formData = new FormData();
    const manifest: Record<string, string> = {};
    
    for (const [path, content] of Object.entries(deployFiles)) {
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append(path, blob, path);
      manifest[`/${path}`] = path;
    }
    
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
        error: 'Erreur lors du déploiement. Veuillez réessayer.',
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
    const maxAttempts = 60;

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
        
        if (deployStatus === 'deploy' && stageStatus === 'success') {
          break;
        }
        
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

    // Récupérer l'URL Cloudflare Pages
    const cloudflareUrl = deployment.url || `https://${projectName}.pages.dev`;
    console.log('✅ Cloudflare Pages deployment successful:', cloudflareUrl);

    // === INTÉGRATION PUBLISHED_PROJECTS ===
    // Générer un subdomain unique pour builtbymagellan.com
    const baseSubdomain = generateSubdomain(siteName || session.title);
    const uniqueSubdomain = await getUniqueSubdomain(supabaseAdmin, baseSubdomain, sessionId);
    const publicUrl = `https://${uniqueSubdomain}.builtbymagellan.com`;

    console.log('🌐 Subdomain:', uniqueSubdomain, '-> Public URL:', publicUrl);

    // Vérifier si le projet est déjà publié
    const { data: existingProject } = await supabaseAdmin
      .from('published_projects')
      .select('*')
      .eq('build_session_id', sessionId)
      .maybeSingle();

    if (existingProject) {
      // Mettre à jour le projet existant
      console.log('🔄 Updating existing published project');
      
      const { error: updateError } = await supabaseAdmin
        .from('published_projects')
        .update({
          subdomain: uniqueSubdomain,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingProject.id);

      if (updateError) {
        console.error('❌ Error updating published project:', updateError);
      }
    } else {
      // Créer un nouveau projet publié
      console.log('✨ Creating new published project entry');
      
      const { error: insertError } = await supabaseAdmin
        .from('published_projects')
        .insert({
          build_session_id: sessionId,
          subdomain: uniqueSubdomain
        });

      if (insertError) {
        console.error('❌ Error creating published project:', insertError);
      }
    }

    // === MISE À JOUR DU WORKER PROXY KV ===
    if (CLOUDFLARE_KV_NAMESPACE_ID) {
      // Mapper subdomain -> projectName (nom du projet Cloudflare Pages)
      await updateProxyKV(
        uniqueSubdomain,
        projectName, // Le worker proxy utilisera ce nom pour construire l'URL pages.dev
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_KV_NAMESPACE_ID
      );
    } else {
      console.warn('⚠️ CLOUDFLARE_KV_NAMESPACE_ID not set, skipping proxy KV update');
    }

    // Mettre à jour la session avec les URLs
    await supabase
      .from('build_sessions')
      .update({ 
        cloudflare_deployment_url: cloudflareUrl,
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    // Vérifier que le site est accessible
    const isAccessible = await verifySiteAccessible(cloudflareUrl);
    
    console.log('✅ Publication complete!');
    console.log('   Cloudflare URL:', cloudflareUrl);
    console.log('   Public URL:', publicUrl);
    console.log('   Accessible:', isAccessible);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl, // URL principale affichée à l'utilisateur
        cloudflareUrl: cloudflareUrl, // URL Cloudflare Pages directe
        subdomain: uniqueSubdomain,
        deployId: deployment.id,
        projectName: projectName,
        isAccessible
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ publish-to-cloudflare error:', error);
    return new Response(
      JSON.stringify({ error: 'Une erreur interne est survenue lors de la publication. Veuillez réessayer.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
