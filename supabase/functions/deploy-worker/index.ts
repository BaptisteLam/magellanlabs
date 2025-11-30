import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  name: string;
  content: string;
  type: 'text' | 'binary';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let { sessionId, projectFiles, projectName } = await req.json();

    if (!sessionId || !projectFiles || !projectName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, projectFiles, projectName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation et conversion de projectFiles si nécessaire
    console.log('📋 Type de projectFiles reçu:', typeof projectFiles, Array.isArray(projectFiles));
    
    if (!Array.isArray(projectFiles)) {
      console.log('⚠️ projectFiles n\'est pas un tableau, tentative de conversion...');
      if (typeof projectFiles === 'object' && projectFiles !== null) {
        // Convertir l'objet en tableau
        projectFiles = Object.entries(projectFiles).map(([name, content]) => ({
          name: name.startsWith('/') ? name : `/${name}`,
          content: String(content),
          type: 'text' as const
        }));
        console.log('✅ Conversion réussie:', projectFiles.length, 'fichiers');
      } else {
        console.error('❌ Impossible de convertir projectFiles');
        return new Response(
          JSON.stringify({ error: 'Invalid projectFiles format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`🚀 Deploying Worker for project: ${projectName} (${projectFiles.length} files)`);
    console.log('📋 Fichiers reçus:', projectFiles.map((f: ProjectFile) => ({
      name: f.name,
      contentLength: f.content?.length || 0,
      type: f.type
    })));

    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const cloudflareEmail = Deno.env.get('CLOUDFLARE_EMAIL');

    console.log('🔍 Cloudflare credentials check:', {
      hasToken: !!cloudflareApiToken,
      tokenLength: cloudflareApiToken?.length || 0,
      hasEmail: !!cloudflareEmail,
      accountId: cloudflareAccountId,
      projectName
    });

    if (!cloudflareApiToken || !cloudflareAccountId || !cloudflareEmail) {
      console.error('❌ Missing Cloudflare credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Cloudflare credentials (API Key, Account ID, or Email)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Create Web Analytics site for this project
    console.log('📊 Creating Web Analytics site...');
    const analyticsHost = `${projectName}.builtbymagellan.com`;
    const analyticsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/rum/site_info`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: analyticsHost,
          auto_install: false,
        }),
      }
    );

    let siteToken = '';
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      siteToken = analyticsData.result?.site_token || '';
      console.log('✅ Web Analytics site created:', siteToken);
    } else {
      const errorText = await analyticsResponse.text();
      console.warn('⚠️ Failed to create Web Analytics site (non-blocking):', errorText);
    }

    console.log('🔍 Cloudflare credentials check:', {
      hasToken: !!cloudflareApiToken,
      tokenLength: cloudflareApiToken?.length || 0,
      hasEmail: !!cloudflareEmail,
      accountId: cloudflareAccountId,
      projectName
    });

    if (!cloudflareApiToken || !cloudflareAccountId || !cloudflareEmail) {
      console.error('❌ Missing Cloudflare credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Cloudflare credentials (API Key, Account ID, or Email)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();

    // Step 2: Inject Web Analytics beacon into HTML files
    if (siteToken) {
      console.log('💉 Injecting Web Analytics beacon into HTML files...');
      const beaconScript = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${siteToken}"}'></script>`;
      
      projectFiles = projectFiles.map((file: ProjectFile) => {
        if (file.name.endsWith('.html') && file.type === 'text') {
          const content = file.content;
          // Inject before closing </head> tag if exists, otherwise before </body>
          if (content.includes('</head>')) {
            file.content = content.replace('</head>', `  ${beaconScript}\n</head>`);
          } else if (content.includes('</body>')) {
            file.content = content.replace('</body>', `  ${beaconScript}\n</body>`);
          } else {
            // Append at the end if no head/body tags
            file.content = content + '\n' + beaconScript;
          }
          console.log(`  ✅ Beacon injected in ${file.name}`);
        }
        return file;
      });
    }

    // Générer le Worker script avec tous les fichiers embarqués
    const workerScript = generateWorkerScript(projectName, projectFiles);

    // Déployer le Worker via l'API Cloudflare
    const workerUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/workers/scripts/${projectName}`;
    
    console.log('📡 Deploying to:', workerUrl);
    
    const formData = new FormData();
    
    // Ajouter le script Worker
    formData.append('worker.js', new Blob([workerScript], { type: 'application/javascript' }), 'worker.js');
    
    // Ajouter les métadonnées (format Service Worker, pas ES Module)
    const metadata = {
      body_part: 'worker.js',
      compatibility_date: '2024-01-01',
      compatibility_flags: []
    };
    formData.append('metadata', JSON.stringify(metadata));

    const deployResponse = await fetch(workerUrl, {
      method: 'PUT',
      headers: {
        'X-Auth-Email': cloudflareEmail,
        'X-Auth-Key': cloudflareApiToken,
      },
      body: formData,
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Worker deployment failed:', deployResponse.status, errorText);
      throw new Error(`Failed to deploy Worker: ${deployResponse.status} - ${errorText}`);
    }

    const deployData = await deployResponse.json();
    console.log('✅ Worker deployed successfully:', deployData);

    // Step 3: Enable workers.dev subdomain
    console.log('🌐 Enabling workers.dev subdomain...');
    const subdomainResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/workers/scripts/${projectName}/subdomain`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: true
        }),
      }
    );

    if (subdomainResponse.ok) {
      const subdomainData = await subdomainResponse.json();
      console.log('✅ Workers.dev subdomain enabled:', subdomainData);
    } else {
      const subdomainError = await subdomainResponse.text();
      console.warn('⚠️ Failed to enable workers.dev subdomain (non-blocking):', subdomainError);
    }

    // Step 4: Ajouter une route pour le domaine personnalisé *.builtbymagellan.com
    const ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID'); // Zone ID de builtbymagellan.com
    
    if (ZONE_ID) {
      console.log(`🔗 Adding route for ${projectName}.builtbymagellan.com...`);
      
      const routeResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/workers/routes`,
        {
          method: 'POST',
          headers: {
            'X-Auth-Email': cloudflareEmail,
            'X-Auth-Key': cloudflareApiToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pattern: `${projectName}.builtbymagellan.com/*`,
            script: projectName,
          }),
        }
      );

      if (routeResponse.ok) {
        const routeData = await routeResponse.json();
        console.log('✅ Route added successfully:', routeData);
      } else {
        const routeError = await routeResponse.text();
        console.error('⚠️ Failed to add route (non-blocking):', routeError);
        // Non-bloquant: on continue même si la route échoue
      }
    } else {
      console.warn('⚠️ CLOUDFLARE_ZONE_ID not set, skipping route creation');
    }

    // Step 5: Configure Preview URLs (associer builtbymagellan.com comme preview)
    console.log('🔗 Configuring Preview URLs...');
    const settingsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/workers/scripts/${projectName}/settings`,
      {
        method: 'PATCH',
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usage_model: 'bundled',
          bindings: [],
          compatibility_date: '2024-01-01',
          compatibility_flags: [],
        }),
      }
    );

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      console.log('✅ Preview URLs configured:', settingsData);
    } else {
      const settingsError = await settingsResponse.text();
      console.warn('⚠️ Failed to configure Preview URLs (non-blocking):', settingsError);
    }

    const deployTime = Date.now() - startTime;
    
    // Construire les URLs publiques
    const workersDevUrl = `https://${projectName}.${cloudflareAccountId}.workers.dev`;
    const customDomainUrl = `https://${projectName}.builtbymagellan.com`;

    console.log('🌐 URLs générées:');
    console.log('  - Workers.dev:', workersDevUrl);
    console.log('  - Custom domain:', customDomainUrl);

    // Mettre à jour la session avec l'URL publique custom domain comme principale
    const { error: updateError } = await supabase
      .from('build_sessions')
      .update({ 
        public_url: customDomainUrl,
        cloudflare_project_name: projectName,
        cloudflare_deployment_url: workersDevUrl, // Stocker aussi l'URL workers.dev
        web_analytics_site_token: siteToken || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('❌ Error updating session:', updateError);
    }

    // Mettre à jour ou créer l'entrée published_projects
    const { data: existingProject } = await supabase
      .from('published_projects')
      .select('*')
      .eq('build_session_id', sessionId)
      .maybeSingle();

    if (existingProject) {
      await supabase
        .from('published_projects')
        .update({
          subdomain: projectName,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingProject.id);
    } else {
      await supabase
        .from('published_projects')
        .insert({
          build_session_id: sessionId,
          subdomain: projectName
        });
    }

    // Déclencher la capture de screenshot en arrière-plan
    supabase.functions.invoke('generate-screenshot', {
      body: { 
        sessionId,
        url: customDomainUrl
      }
    }).catch(err => console.error('Screenshot generation failed:', err));

    console.log(`✅ Worker deployed successfully: ${customDomainUrl} (${deployTime}ms)`);
    console.log(`   Workers.dev URL: ${workersDevUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        publicUrl: customDomainUrl,
        workersDevUrl,
        previewUrls: [customDomainUrl, workersDevUrl], // Les deux URLs comme Preview URLs
        projectName,
        deployTime: `${deployTime}ms`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in deploy-worker function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Génère le script du Worker avec tous les fichiers embarqués
 */
function generateWorkerScript(projectName: string, projectFiles: ProjectFile[]): string {
  console.log('🔧 Génération du Worker script...');
  console.log('📦 Nombre de fichiers à embarquer:', projectFiles.length);
  
  // Créer un objet de fichiers avec les contenus encodés
  const filesMap: Record<string, string> = {};
  
  projectFiles.forEach((file, index) => {
    console.log(`  [${index + 1}/${projectFiles.length}] Traitement: ${file.name} (${file.content?.length || 0} chars, type: ${file.type})`);
    
    // Validation du fichier
    if (!file.name || !file.content) {
      console.warn(`  ⚠️ Fichier invalide ignoré:`, file);
      return;
    }
    
    let content = file.content;
    
    // Pour les fichiers binaires, on les garde en base64
    if (file.type === 'binary') {
      if (!content.includes('base64,')) {
        content = `data:application/octet-stream;base64,${content}`;
      }
    }
    
    // S'assurer que le nom commence par /
    const fileName = file.name.startsWith('/') ? file.name : `/${file.name}`;
    filesMap[fileName] = content;
    console.log(`  ✅ Ajouté: ${fileName}`);
  });

  console.log('📦 Fichiers dans filesMap:', Object.keys(filesMap));
  
  // JSON.stringify gère déjà l'échappement correctement
  const filesJson = JSON.stringify(filesMap);
  console.log('📦 Taille du JSON généré:', filesJson.length, 'caractères');
  console.log('📦 Aperçu du JSON (premiers 500 chars):', filesJson.substring(0, 500));

  // IMPORTANT: Utiliser des concaténations de strings au lieu de template literals
  // pour éviter les conflits avec les backticks et ${} dans le contenu
  const workerScript = `// Worker généré automatiquement pour le projet: ${projectName}
const PROJECT_FILES = ` + filesJson + `;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // Route racine -> index.html
  if (path === '/' || path === '') {
    path = '/index.html';
  }
  
  // Chercher le fichier exact
  let content = PROJECT_FILES[path];
  
  // Si pas trouvé et pas d'extension, essayer avec .html
  if (!content && !path.includes('.')) {
    content = PROJECT_FILES[path + '.html'];
  }
  
  // Si toujours pas trouvé, retourner 404
  if (!content) {
    // Essayer la page 404 custom
    content = PROJECT_FILES['/404.html'];
    if (content) {
      return new Response(content, {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // Page 404 par défaut
    return new Response(generate404Page('` + projectName + `'), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
  
  // Si c'est un fichier binaire (data: URL), on doit le décoder
  if (content.startsWith('data:')) {
    const [header, base64Data] = content.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    
    // Décoder le base64
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Response(bytes, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  }
  
  // Fichier texte normal
  return new Response(content, {
    headers: {
      'Content-Type': getMimeType(path),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function getMimeType(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'txt': 'text/plain; charset=utf-8',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function generate404Page(projectName) {
  return \`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container { text-align: center; max-width: 600px; }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 30px;
      background: #03A5C0;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: bold;
      color: white;
    }
    h1 {
      font-size: 72px;
      font-weight: 700;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #03A5C0, #0288a3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p { font-size: 20px; color: #888; margin-bottom: 40px; line-height: 1.6; }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: #03A5C0;
      color: white;
      text-decoration: none;
      border-radius: 100px;
      font-weight: 600;
      transition: all 0.3s ease;
      border: 2px solid #03A5C0;
    }
    .btn:hover {
      background: transparent;
      color: #03A5C0;
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">M</div>
    <h1>404</h1>
    <p>Désolé, cette page n'existe pas.<br>La ressource est introuvable.</p>
    <a href="/" class="btn">Retour à l'accueil</a>
    <p style="margin-top: 40px; font-size: 14px; color: #666;">Projet: \${projectName}</p>
  </div>
</body>
</html>\`;
}
`.trim();
  
  console.log('📦 Taille totale du Worker script:', workerScript.length, 'caractères');
  console.log('📦 Aperçu du script (premiers 1000 chars):', workerScript.substring(0, 1000));
  
  return workerScript;
}

