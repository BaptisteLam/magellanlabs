import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate the Worker script with embedded files
function generateWorkerScript(sessionId: string, projectFiles: Record<string, string>): string {
  // Escape file contents for embedding in JS
  const escapedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(projectFiles)) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    // Escape backticks and ${} for template literals
    escapedFiles[normalizedPath] = content
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
  }

  const filesJson = JSON.stringify(escapedFiles, null, 2);

  return `
// Worker: ${sessionId}
// Generated: ${new Date().toISOString()}

const PROJECT_FILES = ${filesJson};

// Inspector script for click-to-edit
const INSPECTOR_SCRIPT = \`
<script>
(function() {
  let hoveredElement = null;
  let selectedElement = null;
  
  document.addEventListener('mousemove', function(e) {
    if (e.altKey || e.metaKey) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== hoveredElement && el !== document.body && el !== document.documentElement) {
        if (hoveredElement) {
          hoveredElement.style.outline = '';
        }
        hoveredElement = el;
        hoveredElement.style.outline = '2px dashed rgba(3,165,192,0.8)';
        
        window.parent.postMessage({
          type: 'element-hover',
          rect: el.getBoundingClientRect(),
          tagName: el.tagName.toLowerCase(),
          className: el.className,
          text: el.textContent?.slice(0, 100)
        }, '*');
      }
    }
  });
  
  document.addEventListener('click', function(e) {
    if (e.altKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== document.body && el !== document.documentElement) {
        if (selectedElement) {
          selectedElement.style.outline = '';
        }
        selectedElement = el;
        selectedElement.style.outline = '2px solid rgb(3,165,192)';
        
        window.parent.postMessage({
          type: 'element-select',
          rect: el.getBoundingClientRect(),
          tagName: el.tagName.toLowerCase(),
          className: el.className,
          id: el.id,
          text: el.textContent?.slice(0, 200),
          html: el.outerHTML?.slice(0, 500)
        }, '*');
      }
    }
  });
  
  document.addEventListener('keyup', function(e) {
    if (!e.altKey && !e.metaKey && hoveredElement) {
      hoveredElement.style.outline = '';
      hoveredElement = null;
    }
  });
  
  // Listen for navigation commands from parent
  window.addEventListener('message', function(e) {
    if (e.data.type === 'navigate') {
      window.location.href = e.data.path;
    } else if (e.data.type === 'reload') {
      window.location.reload();
    }
  });
  
  // Intercept link clicks for SPA-like navigation
  document.addEventListener('click', function(e) {
    if (e.altKey || e.metaKey) return;
    
    const link = e.target.closest('a');
    if (link && link.href) {
      const url = new URL(link.href);
      if (url.origin === window.location.origin) {
        e.preventDefault();
        window.parent.postMessage({
          type: 'navigate-request',
          path: url.pathname
        }, '*');
      }
    }
  });
})();
</script>
\`;

// Magellan badge HTML
const MAGELLAN_BADGE = \`
<div id="magellan-badge" style="position:fixed;bottom:16px;right:16px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <a href="https://magellan.dev" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,0.8);border-radius:20px;text-decoration:none;color:white;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:transform 0.2s;">
    <span style="color:rgb(3,165,192);">⚡</span>
    <span>Built with Magellan</span>
  </a>
</div>
<script>
(function(){
  var badge = document.getElementById('magellan-badge');
  if (!badge) return;
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.removedNodes.forEach(function(n) {
        if (n === badge || (n.contains && n.contains(badge))) {
          document.body.appendChild(badge);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(function() {
    badge.style.display = 'block';
    badge.style.visibility = 'visible';
    badge.style.opacity = '1';
  }, 1000);
})();
</script>
\`;

// Generate 404 page
function generate404Page() {
  return \`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
    }
    .container { text-align: center; padding: 2rem; }
    .code { font-size: 8rem; font-weight: bold; color: rgb(3,165,192); line-height: 1; }
    h1 { font-size: 1.5rem; margin: 1rem 0; opacity: 0.9; }
    p { opacity: 0.6; margin-bottom: 2rem; }
    a { 
      display: inline-block; 
      padding: 12px 24px; 
      background: rgb(3,165,192); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px;
      transition: opacity 0.2s;
    }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="code">404</div>
    <h1>Page non trouvée</h1>
    <p>La page que vous recherchez n'existe pas.</p>
    <a href="/" onclick="window.parent.postMessage({type:'navigate-request',path:'/'},'*');return false;">Retour à l'accueil</a>
  </div>
</body>
</html>\`;
}

// Get MIME type from file extension
function getMimeType(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'svg': 'image/svg+xml',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
  };
  return mimeTypes[ext] || 'text/plain';
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  
  // Handle OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  // Normalize path
  if (path === '/' || path === '') {
    path = '/index.html';
  }
  
  // Try exact path first
  let content = PROJECT_FILES[path];
  
  // Try with .html extension
  if (!content && !path.includes('.')) {
    content = PROJECT_FILES[path + '.html'];
    if (content) path = path + '.html';
  }
  
  // Try index.html in directory
  if (!content && !path.includes('.')) {
    const indexPath = path.endsWith('/') ? path + 'index.html' : path + '/index.html';
    content = PROJECT_FILES[indexPath];
    if (content) path = indexPath;
  }
  
  // 404 if not found
  if (!content) {
    return new Response(generate404Page(), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'text/html' },
    });
  }
  
  const mimeType = getMimeType(path);
  
  // Inject inspector and badge into HTML
  if (mimeType === 'text/html') {
    content = content.replace('</head>', INSPECTOR_SCRIPT + '</head>');
    content = content.replace('</body>', MAGELLAN_BADGE + '</body>');
  }
  
  return new Response(content, {
    headers: { ...headers, 'Content-Type': mimeType },
  });
}
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, projectFiles, message } = await req.json();

    if (!sessionId || !projectFiles) {
      return new Response(JSON.stringify({ error: 'sessionId and projectFiles required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🚀 Deploying Worker for session:', sessionId);
    console.log('📁 Files:', Object.keys(projectFiles).length);

    // Verify user owns this session
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate the Worker script
    const workerScript = generateWorkerScript(sessionId, projectFiles);
    const workerName = `magellan-${sessionId}`;

    // Deploy Worker via Cloudflare API
    console.log('📤 Deploying Worker:', workerName);

    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'worker.js',
      compatibility_date: '2024-01-01',
    }));
    formData.append('worker.js', new Blob([workerScript], { type: 'application/javascript+module' }), 'worker.js');

    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'CF-Worker-Message': message || `Deploy ${new Date().toISOString()}`,
        },
        body: formData,
      }
    );

    if (!deployResponse.ok) {
      const errorData = await deployResponse.json();
      console.error('❌ Cloudflare deploy error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'Failed to deploy Worker',
        details: errorData,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deployData = await deployResponse.json();
    console.log('✅ Worker deployed:', deployData.result?.id);

    // Get the version ID
    const versionId = deployData.result?.id || `v${Date.now()}`;

    // Configure custom domain route if needed
    const previewUrl = `https://${sessionId}.builtbymagellan.com`;
    
    if (CLOUDFLARE_ZONE_ID) {
      // Check if route exists
      const routePattern = `${sessionId}.builtbymagellan.com/*`;
      
      const existingRoutesResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/workers/routes`,
        {
          headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
        }
      );

      if (existingRoutesResponse.ok) {
        const existingRoutes = await existingRoutesResponse.json();
        const routeExists = existingRoutes.result?.some((r: any) => r.pattern === routePattern);

        if (!routeExists) {
          console.log('🌐 Creating route:', routePattern);
          
          const routeResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/workers/routes`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                pattern: routePattern,
                script: workerName,
              }),
            }
          );

          if (routeResponse.ok) {
            console.log('✅ Route created');
          } else {
            const routeError = await routeResponse.json();
            console.warn('⚠️ Route creation failed (may already exist):', routeError);
          }
        }
      }
    }

    // Update build_sessions with deployment info
    await supabase
      .from('build_sessions')
      .update({
        project_files: projectFiles,
        cloudflare_project_name: workerName,
        public_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    console.log('✅ Sync complete:', previewUrl);

    return new Response(JSON.stringify({
      success: true,
      previewUrl,
      versionId,
      workerName,
      filesCount: Object.keys(projectFiles).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Sync error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
