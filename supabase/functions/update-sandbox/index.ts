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
    const writeResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/files?path=/home/user/index.html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-API-Key': E2B_API_KEY,
      },
      body: completeHTML,
    });

    if (!writeResponse.ok) {
      const errorText = await writeResponse.text();
      console.error('[update-sandbox] Write error:', errorText);
      throw new Error(`Failed to update files: ${errorText}`);
    }

    // Mettre à jour les autres fichiers
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
