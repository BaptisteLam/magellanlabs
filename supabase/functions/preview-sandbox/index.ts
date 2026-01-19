import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  path: string;
  content: string;
}

interface RequestBody {
  files: ProjectFile[] | Record<string, string>;
  sessionId?: string;
}

// Normaliser les fichiers en format array
function normalizeFiles(files: ProjectFile[] | Record<string, string>): ProjectFile[] {
  if (Array.isArray(files)) {
    return files;
  }
  
  return Object.entries(files).map(([path, content]) => ({
    path: path.startsWith('/') ? path.slice(1) : path,
    content: content as string
  }));
}

// Script de navigation à injecter dans chaque page HTML
const NAVIGATION_SCRIPT = `
<script>
(function() {
  // Notifier le parent du chargement de la page
  function notifyParent() {
    try {
      window.parent.postMessage({
        type: 'PAGE_LOADED',
        path: window.location.pathname.replace('/home/user', '') || '/',
        title: document.title || 'Preview'
      }, '*');
    } catch (e) {
      console.error('[E2B Nav] Error notifying parent:', e);
    }
  }

  // Écouter les messages de navigation du parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    
    switch (e.data.type) {
      case 'NAVIGATE':
        if (e.data.path) {
          let targetPath = e.data.path;
          if (!targetPath.endsWith('.html') && targetPath !== '/') {
            targetPath = targetPath + '.html';
          }
          if (targetPath === '/') targetPath = '/index.html';
          window.location.href = targetPath;
        }
        break;
      case 'RELOAD':
        window.location.reload();
        break;
    }
  });

  // Intercepter les clics sur les liens internes pour navigation fluide
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href) {
      const url = new URL(link.href);
      // Lien interne
      if (url.origin === window.location.origin) {
        e.preventDefault();
        const path = url.pathname;
        window.parent.postMessage({
          type: 'INTERNAL_NAVIGATION',
          path: path
        }, '*');
        window.location.href = path;
      }
    }
  });

  // Notifier au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyParent);
  } else {
    notifyParent();
  }
  
  // Aussi notifier après le load complet
  window.addEventListener('load', notifyParent);
})();
</script>
`;

// Injecter le script de navigation dans le HTML
function injectNavigationScript(html: string): string {
  // Injecter avant </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', NAVIGATION_SCRIPT + '</body>');
  }
  // Sinon ajouter à la fin
  return html + NAVIGATION_SCRIPT;
}

// Générer le HTML complet avec CSS et JS injectés
function processHTMLFile(htmlContent: string, cssContent: string, jsContent: string): string {
  let html = htmlContent;
  
  // Injecter le CSS dans le head si pas déjà présent
  if (cssContent && !html.includes('styles.css') && !html.includes('<link rel="stylesheet"')) {
    const styleTag = `<style>\n${cssContent}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', styleTag + '\n</head>');
    } else if (html.includes('<body')) {
      html = html.replace(/<body([^>]*)>/, `<head>${styleTag}</head><body$1>`);
    } else {
      html = styleTag + '\n' + html;
    }
  }

  // Injecter le JS avant </body> si pas déjà présent
  if (jsContent && !html.includes('app.js') && !html.includes('<script src=')) {
    const scriptTag = `<script>\n${jsContent}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', scriptTag + '\n</body>');
    } else {
      html = html + '\n' + scriptTag;
    }
  }

  // Injecter le script de navigation
  html = injectNavigationScript(html);

  return html;
}

// Fonction pour écrire un fichier via l'API E2B
async function writeFileToSandbox(
  sandboxId: string,
  filePath: string,
  content: string,
  apiKey: string
): Promise<boolean> {
  // Encoder le contenu en base64 (UTF-8)
  const data = new TextEncoder().encode(content);
  const base64Content = btoa(String.fromCharCode(...data));

  const url = `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  // L’API E2B a eu plusieurs variantes (PUT/POST + payload "files" vs payload single).
  // On tente plusieurs formats pour maximiser la compatibilité et on loggue chaque échec.
  const attempts: Array<{ name: string; method: string; body: unknown }> = [
    {
      name: 'put_files_array',
      method: 'PUT',
      body: { files: [{ path: filePath, data: base64Content }] },
    },
    {
      name: 'post_files_array',
      method: 'POST',
      body: { files: [{ path: filePath, data: base64Content }] },
    },
    {
      name: 'put_single',
      method: 'PUT',
      body: { path: filePath, data: base64Content },
    },
    {
      name: 'post_single',
      method: 'POST',
      body: { path: filePath, data: base64Content },
    },
  ];

  for (const attempt of attempts) {
    const res = await fetch(url, {
      method: attempt.method,
      headers,
      body: JSON.stringify(attempt.body),
    });

    if (res.ok) return true;

    let errText = '';
    try {
      errText = await res.text();
    } catch {
      errText = '(no body)';
    }
    console.error(
      `[preview-sandbox] write ${filePath} failed via ${attempt.name} (${res.status}): ${errText}`,
    );
  }

  // Fallback legacy endpoint
  const legacyUrl = `https://api.e2b.dev/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`;
  const legacyRes = await fetch(legacyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-API-Key': apiKey,
    },
    body: content,
  });

  if (!legacyRes.ok) {
    const legacyText = await legacyRes.text().catch(() => '(no body)');
    console.error(
      `[preview-sandbox] write ${filePath} failed via legacy (${legacyRes.status}): ${legacyText}`,
    );
    return false;
  }

  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const E2B_API_KEY = Deno.env.get('E2B_API_KEY');
    if (!E2B_API_KEY) {
      throw new Error('E2B_API_KEY not configured');
    }

    const body: RequestBody = await req.json();
    const { files, sessionId } = body;

    if (!files || (Array.isArray(files) && files.length === 0) || Object.keys(files).length === 0) {
      throw new Error('No files provided');
    }

    const normalizedFiles = normalizeFiles(files);
    console.log('[preview-sandbox] Processing', normalizedFiles.length, 'files');

    // Séparer les fichiers par type
    const htmlFiles = normalizedFiles.filter(f => f.path.endsWith('.html'));
    const cssFile = normalizedFiles.find(f => f.path === 'styles.css' || f.path === 'style.css');
    const jsFile = normalizedFiles.find(f => f.path === 'app.js' || f.path === 'main.js' || f.path === 'script.js');
    const otherFiles = normalizedFiles.filter(f => 
      !f.path.endsWith('.html') && 
      f.path !== 'styles.css' && f.path !== 'style.css' &&
      f.path !== 'app.js' && f.path !== 'main.js' && f.path !== 'script.js'
    );

    const cssContent = cssFile?.content || '';
    const jsContent = jsFile?.content || '';

    const PORT = 8000;
    const PUBLIC_DIR = '/home/user/public';

    // Créer une sandbox E2B
    const createResponse = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: 'base',
        timeout: 300, // 5 minutes
        metadata: {
          sessionId: sessionId || 'unknown',
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[preview-sandbox] E2B create error:', errorText);
      throw new Error(`Failed to create E2B sandbox: ${errorText}`);
    }

    const sandbox = await createResponse.json();
    const sandboxId = sandbox.sandboxID;

    console.log('[preview-sandbox] Created sandbox:', sandboxId);

    // S'assurer que le dossier public existe
    const mkdirRes = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        cmd: `mkdir -p ${PUBLIC_DIR}`,
        cwd: '/home/user',
        background: false,
      }),
    });
    if (!mkdirRes.ok) {
      const t = await mkdirRes.text().catch(() => '(no body)');
      console.warn('[preview-sandbox] mkdir -p failed:', mkdirRes.status, t);
    }

    // Traiter et écrire chaque fichier HTML
    const writtenPages: string[] = [];

    // Si aucun fichier HTML, créer un index.html par défaut
    if (htmlFiles.length === 0) {
      const defaultHTML = processHTMLFile(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div id="app">
    <h1>Preview</h1>
    <p>Aucun fichier HTML généré.</p>
  </div>
</body>
</html>`, cssContent, jsContent);

      const success = await writeFileToSandbox(sandboxId, `${PUBLIC_DIR}/index.html`, defaultHTML, E2B_API_KEY);
      if (success) writtenPages.push('/index.html');
    } else {
      for (const htmlFile of htmlFiles) {
        const processedHTML = processHTMLFile(htmlFile.content, cssContent, jsContent);
        const fileName = htmlFile.path.replace(/^\//, '');
        const filePath = `${PUBLIC_DIR}/${fileName}`;

        const success = await writeFileToSandbox(sandboxId, filePath, processedHTML, E2B_API_KEY);
        if (success) {
          writtenPages.push(`/${fileName}`);
          console.log('[preview-sandbox] Written:', fileName);
        } else {
          console.error('[preview-sandbox] Failed to write:', fileName);
        }
      }
    }

    // Écrire les autres fichiers (images, etc.) dans /public
    for (const file of otherFiles) {
      const fileName = file.path.replace(/^\//, '');
      await writeFileToSandbox(sandboxId, `${PUBLIC_DIR}/${fileName}`, file.content, E2B_API_KEY);
    }

    // Démarrer un serveur HTTP (bind 0.0.0.0) sur PORT=8000.
    // On le lance dans un thread daemon et on garde le process vivant.
    const pythonCmd = `python3 -u -c "import os, threading, time, http.server, socketserver; PORT=${PORT}; os.chdir('${PUBLIC_DIR}'); Handler=http.server.SimpleHTTPRequestHandler; class S(socketserver.ThreadingTCPServer): pass; S.allow_reuse_address=True; httpd=S(('0.0.0.0', PORT), Handler); t=threading.Thread(target=httpd.serve_forever, daemon=True); t.start(); print('HTTP server started', PORT, flush=True); time.sleep(10**9)"`;

    const startServerResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        cmd: pythonCmd,
        cwd: '/home/user',
        background: true,
      }),
    });

    if (!startServerResponse.ok) {
      const t = await startServerResponse.text().catch(() => '(no body)');
      console.error('[preview-sandbox] Failed to start python server:', startServerResponse.status, t);
      throw new Error('Failed to start preview server');
    }

    // Attendre que le serveur démarre
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const previewUrl = `https://${sandboxId}-${PORT}.e2b.dev`;

    console.log('[preview-sandbox] Preview URL:', previewUrl, 'Pages:', writtenPages);

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        previewUrl,
        filesCount: normalizedFiles.length,
        pages: writtenPages,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[preview-sandbox] Error:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
