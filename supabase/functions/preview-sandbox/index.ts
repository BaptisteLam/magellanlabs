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

// Générer le HTML complet avec CSS et JS injectés
function generateCompleteHTML(files: ProjectFile[]): string {
  let html = files.find(f => f.path === 'index.html' || f.path === '/index.html')?.content || '';
  const css = files.find(f => f.path === 'styles.css' || f.path === '/styles.css')?.content || '';
  const js = files.find(f => f.path === 'app.js' || f.path === '/app.js')?.content || '';
  
  if (!html) {
    // HTML par défaut si manquant
    html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div id="app">
    <h1>Aucun contenu</h1>
    <p>Le fichier index.html n'a pas été généré.</p>
  </div>
</body>
</html>`;
  }

  // Injecter le CSS dans le head si pas déjà présent
  if (css && !html.includes('<style>') && !html.includes('styles.css')) {
    html = html.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  }

  // Injecter le JS avant </body> si pas déjà présent
  if (js && !html.includes('<script>') && !html.includes('app.js')) {
    html = html.replace('</body>', `<script>\n${js}\n</script>\n</body>`);
  }

  return html;
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

    // Générer le HTML complet avec CSS/JS injectés
    const completeHTML = generateCompleteHTML(normalizedFiles);
    
    console.log('[preview-sandbox] Generated HTML length:', completeHTML.length);

    // Créer une sandbox E2B avec le template de base
    const createResponse = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: 'base', // Template de base avec Node.js
        timeout: 300, // 5 minutes
        metadata: {
          sessionId: sessionId || 'unknown'
        }
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

    // Écrire le fichier HTML principal
    const writeResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/files?path=/home/user/index.html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-API-Key': E2B_API_KEY,
      },
      body: completeHTML,
    });

    if (!writeResponse.ok) {
      console.error('[preview-sandbox] Write file error:', await writeResponse.text());
    }

    // Écrire les autres fichiers (CSS, JS séparés si nécessaire)
    for (const file of normalizedFiles) {
      if (file.path !== 'index.html' && file.path !== '/index.html') {
        const filePath = file.path.startsWith('/') ? file.path : `/${file.path}`;
        await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/files?path=/home/user${filePath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-API-Key': E2B_API_KEY,
          },
          body: file.content,
        });
      }
    }

    // Démarrer un serveur HTTP simple avec Python (plus léger que Node)
    const startServerResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        cmd: 'cd /home/user && python3 -m http.server 3000 &',
        timeout: 10,
        background: true,
      }),
    });

    if (!startServerResponse.ok) {
      // Si Python échoue, essayer avec npx serve
      console.log('[preview-sandbox] Python server failed, trying npx serve...');
      await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': E2B_API_KEY,
        },
        body: JSON.stringify({
          cmd: 'cd /home/user && npx -y serve -p 3000 &',
          timeout: 30,
          background: true,
        }),
      });
    }

    // Attendre que le serveur démarre
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Construire l'URL de preview
    const previewUrl = `https://${sandboxId}-3000.e2b.dev`;
    
    console.log('[preview-sandbox] Preview URL:', previewUrl);

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        previewUrl,
        filesCount: normalizedFiles.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
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
