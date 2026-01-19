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
  const data = new TextEncoder().encode(content);
  const base64Content = btoa(String.fromCharCode(...data));

  const url = `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  const attempts: Array<{ name: string; method: string; body: unknown }> = [
    { name: 'put_files_array', method: 'PUT', body: { files: [{ path: filePath, data: base64Content }] } },
    { name: 'post_files_array', method: 'POST', body: { files: [{ path: filePath, data: base64Content }] } },
    { name: 'put_single', method: 'PUT', body: { path: filePath, data: base64Content } },
    { name: 'post_single', method: 'POST', body: { path: filePath, data: base64Content } },
  ];

  for (const attempt of attempts) {
    const res = await fetch(url, {
      method: attempt.method,
      headers,
      body: JSON.stringify(attempt.body),
    });

    if (res.ok) return true;

    const errText = await res.text().catch(() => '(no body)');
    console.error(
      `[update-sandbox] write ${filePath} failed via ${attempt.name} (${res.status}): ${errText}`,
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
      `[update-sandbox] write ${filePath} failed via legacy (${legacyRes.status}): ${legacyText}`,
    );
    return false;
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

    const PUBLIC_DIR = '/home/user/public';

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
      console.warn('[update-sandbox] mkdir -p failed:', mkdirRes.status, t);
    }

    // Générer le HTML complet avec CSS/JS injectés
    const completeHTML = generateCompleteHTML(normalizedFiles);

    // Mettre à jour le fichier HTML principal
    const success = await writeFileToSandbox(sandboxId, `${PUBLIC_DIR}/index.html`, completeHTML, E2B_API_KEY);

    if (!success) {
      throw new Error('Failed to update main HTML file');
    }

    // Mettre à jour les autres fichiers
    for (const file of normalizedFiles) {
      if (file.path !== 'index.html' && file.path !== '/index.html') {
        const fileName = file.path.replace(/^\//, '');
        await writeFileToSandbox(sandboxId, `${PUBLIC_DIR}/${fileName}`, file.content, E2B_API_KEY);
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
