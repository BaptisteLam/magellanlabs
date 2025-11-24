import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
    console.log('🚀 Deploy to Cloudflare Pages function called');
    
    // Authentication
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Service key present:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    const requestBody = await req.json();
    const { sessionId, projectFiles } = requestBody;
    
    console.log('Session ID:', sessionId);
    console.log('Files count:', projectFiles?.length);
    
    if (!sessionId || !projectFiles) {
      console.error('❌ Missing sessionId or projectFiles');
      return new Response(
        JSON.stringify({ error: 'Session ID and project files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Deploying project to Cloudflare Pages...');
    
    const GA_MEASUREMENT_ID = Deno.env.get('GA_MEASUREMENT_ID');
    console.log('GA4 Measurement ID configured:', !!GA_MEASUREMENT_ID);

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('build_sessions')
      .select('cloudflare_project_name, cloudflare_deployment_url, title, github_repo_name, github_repo_url')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      throw new Error(`Failed to get session: ${sessionError.message}`);
    }

    console.log('Session data retrieved:', session?.title);

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Cloudflare credentials not configured');
    }

    if (!GITHUB_TOKEN) {
      throw new Error('GitHub token not configured');
    }

    // ============= ÉTAPE 1: CRÉATION ET PUSH VERS GITHUB =============
    console.log('📦 Starting GitHub repository creation and push...');
    
    const baseTitle = session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site';
    const uniqueId = sessionId.slice(0, 8);
    const repoName = session.github_repo_name || `${baseTitle}-${uniqueId}`;
    
    let githubRepoUrl = session.github_repo_url;
    
    // Si le repo n'existe pas encore, le créer
    if (!session.github_repo_name) {
      console.log('🔨 Creating new GitHub repository:', repoName);
      
      const createRepoResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoName,
          description: `Website: ${session.title || 'Sans titre'}`,
          private: false,
          auto_init: false,
        }),
      });
      
      if (!createRepoResponse.ok) {
        const errorText = await createRepoResponse.text();
        console.error('❌ Failed to create GitHub repo:', errorText);
        throw new Error(`Failed to create GitHub repository: ${errorText}`);
      }
      
      const repoData = await createRepoResponse.json();
      githubRepoUrl = repoData.html_url;
      console.log('✅ GitHub repository created:', githubRepoUrl);
    } else {
      console.log('📂 Using existing GitHub repository:', githubRepoUrl);
    }
    
    // Pusher les fichiers vers GitHub
    console.log('📤 Pushing files to GitHub...');
    
    // Récupérer l'utilisateur GitHub pour connaître le owner
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get GitHub user info');
    }
    
    const githubUser = await userResponse.json();
    const owner = githubUser.login;
    
    // Créer un commit avec tous les fichiers
    // 1. Obtenir la référence de la branche main (ou créer si nécessaire)
    let sha: string | null = null;
    try {
      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (refResponse.ok) {
        const refData = await refResponse.json();
        sha = refData.object.sha;
      }
    } catch (e) {
      console.log('Branch main does not exist yet, will create it');
    }
    
    // 2. Créer les blobs pour chaque fichier
    const blobs: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    
    for (const file of projectFiles) {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      
      let content: string;
      if (file.content.startsWith('data:')) {
        // Fichier binaire (image, etc.)
        content = file.content.split(',')[1]; // Garder en base64
      } else {
        // Fichier texte
        content = btoa(unescape(encodeURIComponent(file.content))); // Encoder en base64
      }
      
      const blobResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content,
            encoding: 'base64',
          }),
        }
      );
      
      if (!blobResponse.ok) {
        const errorText = await blobResponse.text();
        console.error(`❌ Failed to create blob for ${fileName}:`, errorText);
        continue;
      }
      
      const blobData = await blobResponse.json();
      blobs.push({
        path: fileName,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      });
    }
    
    // 3. Créer un tree avec tous les blobs
    const createTreeBody: any = {
      tree: blobs,
    };
    
    if (sha) {
      createTreeBody.base_tree = sha;
    }
    
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createTreeBody),
      }
    );
    
    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      throw new Error(`Failed to create tree: ${errorText}`);
    }
    
    const treeData = await treeResponse.json();
    
    // 4. Créer un commit
    const commitBody: any = {
      message: `Deploy: ${new Date().toISOString()}`,
      tree: treeData.sha,
    };
    
    if (sha) {
      commitBody.parents = [sha];
    }
    
    const commitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commitBody),
      }
    );
    
    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      throw new Error(`Failed to create commit: ${errorText}`);
    }
    
    const commitData = await commitResponse.json();
    
    // 5. Mettre à jour la référence main (ou la créer)
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`,
      {
        method: sha ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          sha 
            ? { sha: commitData.sha, force: true }
            : { ref: 'refs/heads/main', sha: commitData.sha }
        ),
      }
    );
    
    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text();
      throw new Error(`Failed to update ref: ${errorText}`);
    }
    
    console.log('✅ Files pushed to GitHub successfully');
    
    // Sauvegarder les infos GitHub dans la session
    await supabaseAdmin
      .from('build_sessions')
      .update({
        github_repo_name: repoName,
        github_repo_url: githubRepoUrl,
      })
      .eq('id', sessionId);
    
    // ============= ÉTAPE 2: DÉPLOIEMENT SUR CLOUDFLARE =============
    console.log('🚀 Starting Cloudflare Pages deployment...');

    // Inject GA4 script if configured
    let modifiedFiles = [...projectFiles];
    if (GA_MEASUREMENT_ID) {
      console.log('📊 Injecting GA4 tracking script...');
      
      const gaScript = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}', {
    'page_path': window.location.pathname,
    'custom_map': {'dimension1': 'hostname'}
  });
  gtag('event', 'page_view', {
    'hostname': window.location.hostname
  });
</script>`;
      
      const htmlFileIndex = modifiedFiles.findIndex((f: ProjectFile) => f.name === 'index.html');
      if (htmlFileIndex !== -1) {
        const originalHtml = modifiedFiles[htmlFileIndex].content;
        
        let updatedHtml = originalHtml;
        if (originalHtml.includes('</head>')) {
          updatedHtml = originalHtml.replace('</head>', `${gaScript}\n</head>`);
        } else if (originalHtml.includes('<body')) {
          updatedHtml = originalHtml.replace('<body', `${gaScript}\n<body`);
        } else {
          updatedHtml = gaScript + '\n' + originalHtml;
        }
        
        modifiedFiles[htmlFileIndex] = {
          ...modifiedFiles[htmlFileIndex],
          content: updatedHtml
        };
      }
    }

    // Function to create FormData with SHA-256 hashes for Direct Upload
    async function createFormData(files: ProjectFile[]) {
      console.log('🔐 Creating FormData with SHA-256 hashes for', files.length, 'files');
      const formData = new FormData();
      const manifest: Record<string, string> = {};
      
      // Vérifications critiques
      const hasIndexHtml = files.some(f => f.name === 'index.html' || f.name === '/index.html');
      const hasRoutesJson = files.some(f => f.name === '_routes.json' || f.name === '/_routes.json');
      
      console.log('📋 Vérifications:');
      console.log('  ✅ index.html présent:', hasIndexHtml);
      console.log('  ℹ️ _routes.json présent:', hasRoutesJson);
      
      if (!hasIndexHtml) {
        console.warn('⚠️ ATTENTION: index.html manquant - le site ne s\'affichera pas!');
      }
      
      // Générer _routes.json seulement si Claude ne l'a pas déjà généré
      if (!hasRoutesJson) {
        const routesConfig = {
          version: 1,
          include: ["/*"],
          exclude: []  // Ne rien exclure pour permettre à Cloudflare de servir tous les fichiers statiques
        };
        
        const routesContent = JSON.stringify(routesConfig, null, 2);
        const encoder = new TextEncoder();
        const routesBuffer = encoder.encode(routesContent).buffer;
        const routesHash = await crypto.subtle.digest("SHA-256", routesBuffer);
        const routesHashArray = Array.from(new Uint8Array(routesHash));
        const routesHashHex = routesHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        manifest['/_routes.json'] = routesHashHex;
        formData.append(routesHashHex, new Blob([routesBuffer]), '_routes.json');
        console.log('  ✅ _routes.json auto-généré avec exclude: [] pour servir tous les assets');
        console.log('     Config:', JSON.stringify(routesConfig, null, 2));
      } else {
        console.log('  ✅ _routes.json fourni par Claude - utilisation de celui-ci');
      }
      
      for (const file of files) {
        // Normaliser le nom de fichier - toujours enlever / au début
        let fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
        
        // IMPORTANT: Cloudflare Pages exige que tous les fichiers soient à la racine
        // Les fichiers dans des sous-dossiers doivent avoir leur chemin complet
        if (fileName.includes('/')) {
          console.log(`  📁 Fichier avec chemin: ${fileName}`);
        }
        
        // Convertir le contenu en ArrayBuffer
        let fileBuffer: ArrayBuffer;
        if (file.content.startsWith('data:')) {
          const base64Data = file.content.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileBuffer = bytes.buffer;
        } else {
          const encoder = new TextEncoder();
          fileBuffer = encoder.encode(file.content).buffer;
        }
        
        // Calculer le SHA-256 hash complet (64 caractères hex)
        const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        console.log(`  ✅ ${fileName}`);
        console.log(`     Hash: ${fileHash}`);
        console.log(`     Size: ${fileBuffer.byteLength} bytes`);
        
        // CRITICAL: Le manifest doit avoir "/" au début, le nom de fichier dans FormData NON
        manifest[`/${fileName}`] = fileHash;
        
        // Ajouter au FormData - IMPORTANT: utiliser le hash comme clé, nom de fichier comme filename
        const blob = new Blob([fileBuffer]);
        formData.append(fileHash, blob, fileName);
      }
      
      formData.append('manifest', JSON.stringify(manifest));
      console.log('✅ FormData created with manifest:', Object.keys(manifest).length, 'files');
      console.log('📦 Manifest:', JSON.stringify(manifest, null, 2));
      return formData;
    }
    
    const projectName = session.cloudflare_project_name || `${baseTitle}-${uniqueId}`;
    
    console.log('🚀 Deploying to Cloudflare Pages project:', projectName);
    
    // Create FormData with SHA-256 hashes for Direct Upload
    const formData = await createFormData(modifiedFiles);
    
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

    let deployResult;
    
    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      
      // If project doesn't exist, create it first
      if (deployResponse.status === 404) {
        console.log('📝 Creating new Cloudflare Pages project...');
        
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
        
        if (!createProjectResponse.ok) {
          const createError = await createProjectResponse.text();
          console.error('❌ Failed to create project:', createError);
          throw new Error(`Failed to create Cloudflare Pages project: ${createError}`);
        }
        
        console.log('✅ Project created, retrying deployment...');
        
        // Retry deployment with Direct Upload
        const retryFormData = await createFormData(modifiedFiles);
        
        const retryResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            },
            body: retryFormData,
          }
        );
        
        if (!retryResponse.ok) {
          const retryError = await retryResponse.text();
          throw new Error(`Deployment failed after project creation: ${retryError}`);
        }
        
        deployResult = await retryResponse.json();
      } else {
        throw new Error(`Deployment failed: ${errorText}`);
      }
    } else {
      deployResult = await deployResponse.json();
    }

    console.log('✅ Deployed to Cloudflare Pages:', deployResult);

    const deploymentUrl = deployResult.result?.url || `https://${projectName}.pages.dev`;

    // Update session
    const { error: updateError } = await supabaseAdmin
      .from('build_sessions')
      .update({
        cloudflare_project_name: projectName,
        cloudflare_deployment_url: deploymentUrl,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update session:', updateError);
    }

    // Create or update website entry
    console.log('📝 Creating/updating website entry...');
    
    const htmlFile = modifiedFiles.find((f: ProjectFile) => f.name === 'index.html');
    const htmlContent = htmlFile?.content || '';
    
    const { data: existingWebsite } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('build_session_id', sessionId)
      .maybeSingle();
    
    let websiteId: string;
    
    if (existingWebsite) {
      websiteId = existingWebsite.id;
      
      const { error: websiteUpdateError } = await supabaseAdmin
        .from('websites')
        .update({
          cloudflare_url: deploymentUrl,
          cloudflare_project_name: projectName,
          html_content: htmlContent,
          title: session.title || 'Sans titre',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWebsite.id);
      
      if (websiteUpdateError) {
        console.error('⚠️ Failed to update website:', websiteUpdateError);
      } else {
        console.log('✅ Website entry updated');
      }
    } else {
      const { data: newWebsite, error: websiteInsertError } = await supabaseAdmin
        .from('websites')
        .insert({
          user_id: user.id,
          title: session.title || 'Sans titre',
          cloudflare_url: deploymentUrl,
          cloudflare_project_name: projectName,
          html_content: htmlContent,
          build_session_id: sessionId,
        })
        .select('id')
        .single();
      
      if (websiteInsertError || !newWebsite) {
        console.error('⚠️ Failed to create website:', websiteInsertError);
        websiteId = '';
      } else {
        console.log('✅ Website entry created');
        websiteId = newWebsite.id;
      }
    }
    
    if (websiteId) {
      const { error: linkError } = await supabaseAdmin
        .from('build_sessions')
        .update({ website_id: websiteId })
        .eq('id', sessionId);
      
      if (linkError) {
        console.error('⚠️ Failed to link session to website:', linkError);
      } else {
        console.log('✅ Session linked to website');
      }
    }
    
    // Generate screenshot (fire and forget)
    console.log('📸 Generating screenshot...');
    
    const screenshotPromise = fetch(`${supabaseUrl}/functions/v1/generate-screenshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: deploymentUrl,
        sessionId: sessionId,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        console.error('⚠️ Screenshot generation failed:', error);
      } else {
        const data = await response.json();
        console.log('✅ Screenshot generated:', data?.thumbnailUrl);
      }
    }).catch((error) => {
      console.error('⚠️ Screenshot error:', error);
    });
    
    screenshotPromise;

    console.log('✅ Deployment successful:', deploymentUrl);

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        projectName: projectName,
        websiteId: websiteId || null,
        state: deployResult.result?.latest_stage?.status || 'active',
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
