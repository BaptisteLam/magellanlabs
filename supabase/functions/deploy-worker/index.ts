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
      console.log('📊 Site token:', siteToken);
      console.log('🌐 Analytics host:', analyticsHost);
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
          console.log(`  📄 HTML preview (first 500 chars):`, file.content.substring(0, 500));
        }
        return file;
      });
    } else {
      console.warn('⚠️ No siteToken available, analytics beacon not injected');
    }

    // Step 3: Inject Magellan badge for all published sites
    console.log('🏷️ Injecting Magellan badge...');
    const magellanBadge = `
<!-- Magellan Badge -->
<style>
  #magellan-badge {
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    width: 140px !important;
    height: 48px !important;
    background: rgba(255, 255, 255, 0.98) !important;
    border: 1px solid rgba(3, 165, 192, 0.2) !important;
    border-radius: 12px !important;
    padding: 8px 12px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-decoration: none !important;
    transition: all 0.2s ease !important;
    z-index: 2147483647 !important;
    cursor: pointer !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  #magellan-badge:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15) !important;
  }
  #magellan-badge svg {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
  }
</style>
<a id="magellan-badge" href="https://builtbymagellan.com" target="_blank" rel="noopener" aria-label="Built with Magellan">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 810" preserveAspectRatio="xMidYMid meet">
    <g transform="translate(596, 276)">
      <g fill="#000000">
        <g transform="translate(2.847036, 189.762636)">
          <path d="M 141.25 -124.671875 L 141.25 0 L 124.859375 0 L 124.859375 -92.96875 L 83.421875 0 L 71.890625 0 L 30.265625 -93.15625 L 30.265625 0 L 13.875 0 L 13.875 -124.671875 L 31.53125 -124.671875 L 77.65625 -21.625 L 123.78125 -124.671875 Z"/>
        </g>
      </g>
      <g fill="#000000">
        <g transform="translate(157.946796, 189.762636)">
          <path d="M 7.75 -49.734375 C 7.75 -59.816406 9.789062 -68.671875 13.875 -76.296875 C 17.957031 -83.929688 23.570312 -89.847656 30.71875 -94.046875 C 37.863281 -98.253906 45.820312 -100.359375 54.59375 -100.359375 C 63.238281 -100.359375 70.742188 -98.492188 77.109375 -94.765625 C 83.472656 -91.046875 88.21875 -86.363281 91.34375 -80.71875 L 91.34375 -98.734375 L 107.921875 -98.734375 L 107.921875 0 L 91.34375 0 L 91.34375 -18.375 C 88.101562 -12.613281 83.269531 -7.835938 76.84375 -4.046875 C 70.414062 -0.265625 62.9375 1.625 54.40625 1.625 C 45.644531 1.625 37.71875 -0.535156 30.625 -4.859375 C 23.539062 -9.179688 17.957031 -15.242188 13.875 -23.046875 C 9.789062 -30.859375 7.75 -39.753906 7.75 -49.734375 Z M 91.34375 -49.546875 C 91.34375 -56.992188 89.84375 -63.476562 86.84375 -69 C 83.84375 -74.53125 79.789062 -78.765625 74.6875 -81.703125 C 69.582031 -84.648438 63.960938 -86.125 57.828125 -86.125 C 51.703125 -86.125 46.117188 -84.679688 41.078125 -81.796875 C 36.035156 -78.910156 32.007812 -74.703125 29 -69.171875 C 26 -63.648438 24.5 -57.171875 24.5 -49.734375 C 24.5 -42.160156 26 -35.582031 29 -30 C 32.007812 -24.414062 36.035156 -20.148438 41.078125 -17.203125 C 46.117188 -14.265625 51.703125 -12.796875 57.828125 -12.796875 C 63.960938 -12.796875 69.582031 -14.265625 74.6875 -17.203125 C 79.789062 -20.148438 83.84375 -24.414062 86.84375 -30 C 89.84375 -35.582031 91.34375 -42.097656 91.34375 -49.546875 Z"/>
        </g>
      </g>
      <g fill="#000000">
        <g transform="translate(279.720842, 189.762636)">
          <path d="M 54.59375 -100.359375 C 63.125 -100.359375 70.597656 -98.492188 77.015625 -94.765625 C 83.441406 -91.046875 88.21875 -86.363281 91.34375 -80.71875 L 91.34375 -98.734375 L 107.921875 -98.734375 L 107.921875 2.15625 C 107.921875 11.164062 106 19.179688 102.15625 26.203125 C 98.3125 33.234375 92.816406 38.726562 85.671875 42.6875 C 78.535156 46.644531 70.101562 48.625 60.375 48.625 C 46.863281 48.625 35.710938 45.40625 26.921875 38.96875 C 18.140625 32.53125 13.03125 23.796875 11.59375 12.765625 L 27.90625 12.765625 C 29.226562 19.828125 32.585938 25.363281 37.984375 29.375 C 43.390625 33.394531 50.222656 35.40625 58.484375 35.40625 C 67.640625 35.40625 74.878906 32.78125 80.203125 27.53125 C 85.535156 22.28125 88.203125 14.734375 88.203125 4.890625 L 88.203125 -14.421875 C 85.078125 -8.910156 80.332031 -4.4375 73.96875 -1 C 67.613281 2.4375 60.082031 4.15625 51.375 4.15625 C 42.738281 4.15625 34.816406 2.019531 27.609375 -2.25 C 20.410156 -6.519531 14.734375 -12.460938 10.578125 -20.078125 C 6.421875 -27.703125 4.34375 -36.425781 4.34375 -46.25 C 4.34375 -56.082031 6.378906 -64.835938 10.453125 -72.515625 C 14.535156 -80.191406 20.132812 -86.148438 27.25 -90.390625 C 34.375 -94.640625 42.316406 -96.765625 51.078125 -96.765625 Z M 91.34375 -45.875 C 91.34375 -52.0625 89.875 -57.695312 86.9375 -62.78125 C 84.007812 -67.863281 79.988281 -71.910156 74.875 -74.921875 C 69.769531 -77.929688 64.148438 -79.4375 58.015625 -79.4375 C 51.890625 -79.4375 46.300781 -77.960938 41.25 -75.015625 C 36.207031 -72.066406 32.1875 -68.050781 29.1875 -62.96875 C 26.195312 -57.882812 24.703125 -52.285156 24.703125 -46.171875 C 24.703125 -40.054688 26.160156 -34.46875 29.078125 -29.40625 C 32.003906 -24.351562 36.007812 -20.332031 41.09375 -17.34375 C 46.1875 -14.363281 51.796875 -12.875 57.921875 -12.875 C 64.054688 -12.875 69.675781 -14.363281 74.78125 -17.34375 C 79.882812 -20.332031 83.9375 -24.382812 86.9375 -29.5 C 89.9375 -34.625 91.4375 -40.3125 91.4375 -46.5625 Z"/>
        </g>
      </g>
      <g fill="#000000">
        <g transform="translate(403.190074, 189.762636)">
          <path d="M 91.921875 -88.953125 C 95.035156 -93.515625 99.363281 -97.242188 104.90625 -100.140625 C 110.445312 -103.046875 116.796875 -104.5 123.953125 -104.5 C 132.578125 -104.5 140.367188 -102.398438 147.328125 -98.203125 C 154.296875 -94.015625 159.707031 -88.160156 163.5625 -80.640625 C 167.414062 -73.117188 169.34375 -64.363281 169.34375 -54.375 L 169.34375 0 L 152.765625 0 L 152.765625 -54.0625 C 152.765625 -63.3125 150.269531 -70.445312 145.28125 -75.46875 C 140.300781 -80.488281 133.878906 -82.999688 126.015625 -82.999688 C 118.023438 -82.999688 111.523438 -80.488281 106.515625 -75.46875 C 101.515625 -70.445312 99.015625 -63.3125 99.015625 -54.0625 L 99.015625 0 L 82.4375 0 L 82.4375 -54.0625 C 82.4375 -63.3125 79.9375 -70.445312 74.9375 -75.46875 C 69.9375 -80.488281 63.507812 -82.999688 55.65625 -82.999688 C 47.664062 -82.999688 41.179688 -80.488281 36.203125 -75.46875 C 31.234375 -70.445312 28.75 -63.3125 28.75 -54.0625 L 28.75 0 L 12.171875 0 L 12.171875 -98.734375 L 28.75 -98.734375 L 28.75 -80.71875 C 31.75 -86.125 36.046875 -90.582031 41.640625 -94.09375 C 47.234375 -97.601562 53.703125 -99.359375 61.046875 -99.359375 C 68.929688 -99.359375 75.988281 -97.398438 82.21875 -93.484375 C 88.445312 -89.566406 93.085938 -84.160156 96.140625 -77.265625 Z"/>
        </g>
      </g>
      <g fill="#03A5C0">
        <g transform="translate(585.406509, 189.762636)">
          <path d="M 91.921875 -88.953125 C 95.035156 -93.515625 99.363281 -97.242188 104.90625 -100.140625 C 110.445312 -103.046875 116.796875 -104.5 123.953125 -104.5 C 132.578125 -104.5 140.367188 -102.398438 147.328125 -98.203125 C 154.296875 -94.015625 159.707031 -88.160156 163.5625 -80.640625 C 167.414062 -73.117188 169.34375 -64.363281 169.34375 -54.375 L 169.34375 0 L 152.765625 0 L 152.765625 -54.0625 C 152.765625 -63.3125 150.269531 -70.445312 145.28125 -75.46875 C 140.300781 -80.488281 133.878906 -82.999688 126.015625 -82.999688 C 118.023438 -82.999688 111.523438 -80.488281 106.515625 -75.46875 C 101.515625 -70.445312 99.015625 -63.3125 99.015625 -54.0625 L 99.015625 0 L 82.4375 0 L 82.4375 -54.0625 C 82.4375 -63.3125 79.9375 -70.445312 74.9375 -75.46875 C 69.9375 -80.488281 63.507812 -82.999688 55.65625 -82.999688 C 47.664062 -82.999688 41.179688 -80.488281 36.203125 -75.46875 C 31.234375 -70.445312 28.75 -63.3125 28.75 -54.0625 L 28.75 0 L 12.171875 0 L 12.171875 -98.734375 L 28.75 -98.734375 L 28.75 -80.71875 C 31.75 -86.125 36.046875 -90.582031 41.640625 -94.09375 C 47.234375 -97.601562 53.703125 -99.359375 61.046875 -99.359375 C 68.929688 -99.359375 75.988281 -97.398438 82.21875 -93.484375 C 88.445312 -89.566406 93.085938 -84.160156 96.140625 -77.265625 Z"/>
        </g>
      </g>
    </g>
  </svg>
</a>
<script>
(function(){
  var badge = document.getElementById('magellan-badge');
  if (!badge) return;
  
  var observer = new MutationObserver(function(mutations) {
    if (!document.getElementById('magellan-badge')) {
      document.body.appendChild(badge.cloneNode(true));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  setInterval(function() {
    var b = document.getElementById('magellan-badge');
    if (b) {
      b.style.setProperty('display', 'flex', 'important');
      b.style.setProperty('visibility', 'visible', 'important');
      b.style.setProperty('opacity', '1', 'important');
    }
  }, 1000);
})();
</script>
`;

    projectFiles = projectFiles.map((file: ProjectFile) => {
      if (file.name.endsWith('.html') && file.type === 'text') {
        const content = file.content;
        if (content.includes('</body>')) {
          file.content = content.replace('</body>', `${magellanBadge}\n</body>`);
        } else {
          file.content = content + magellanBadge;
        }
        console.log(`  🏷️ Badge Magellan injecté dans ${file.name}`);
      }
      return file;
    });

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

