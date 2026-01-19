import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  path: string;
  content: string;
}

// Générer le HTML complet avec CSS et JS injectés
function generateCompleteHTML(files: ProjectFile[]): string {
  let html = files.find(f => f.path === 'index.html' || f.path === '/index.html')?.content || '';
  const css = files.find(f => f.path === 'styles.css' || f.path === '/styles.css')?.content || '';
  const js = files.find(f => f.path === 'app.js' || f.path === '/app.js')?.content || '';
  
  if (!html) return '';

  // Injecter le CSS dans le head
  if (css && !html.includes('<style>') && !html.includes('styles.css')) {
    html = html.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  }

  // Injecter le JS avant </body>
  if (js && !html.includes('<script>') && !html.includes('app.js')) {
    html = html.replace('</body>', `<script>\n${js}\n</script>\n</body>`);
  }

  return html;
}

function normalizeFiles(files: ProjectFile[] | Record<string, string>): ProjectFile[] {
  if (Array.isArray(files)) {
    return files;
  }
  return Object.entries(files).map(([path, content]) => ({
    path: path.startsWith('/') ? path.slice(1) : path,
    content: content as string
  }));
}

// Fonction pour écrire un fichier via l'API E2B
async function writeFileToSandbox(
  sandboxId: string, 
  filePath: string, 
  content: string, 
  apiKey: string
): Promise<boolean> {
  // Encoder le contenu en base64
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const base64Content = btoa(String.fromCharCode(...data));
  
  const response = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/filesystem`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      files: [{
        path: filePath,
        data: base64Content
      }]
    }),
  });

  if (!response.ok) {
    // Essayer l'ancienne API comme fallback
    const fallbackResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-API-Key': apiKey,
      },
      body: content,
    });
    
    if (!fallbackResponse.ok) {
      console.error(`[update-sandbox] Failed to write ${filePath}:`, await fallbackResponse.text());
      return false;
    }
  }
  
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const E2B_API_KEY = Deno.env.get('E2B_API_KEY');
    if (!E2B_API_KEY) {
      throw new Error('E2B_API_KEY not configured');
    }

    const { sandboxId, files } = await req.json();

    if (!sandboxId || !files) {
      throw new Error('sandboxId and files are required');
    }

    const normalizedFiles = normalizeFiles(files);
    console.log('[update-sandbox] Updating', normalizedFiles.length, 'files in sandbox:', sandboxId);

    // Générer le HTML complet avec CSS/JS injectés
    const completeHTML = generateCompleteHTML(normalizedFiles);

    // Mettre à jour le fichier HTML principal
    const success = await writeFileToSandbox(sandboxId, '/home/user/index.html', completeHTML, E2B_API_KEY);

    if (!success) {
      throw new Error('Failed to update main HTML file');
    }

    // Mettre à jour les autres fichiers
    for (const file of normalizedFiles) {
      if (file.path !== 'index.html' && file.path !== '/index.html') {
        const fileName = file.path.replace(/^\//, '');
        await writeFileToSandbox(sandboxId, `/home/user/${fileName}`, file.content, E2B_API_KEY);
      }
    }

    console.log('[update-sandbox] Files updated successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[update-sandbox] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
