import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  path: string;
  content: string;
}

// Normalize files to Record format
function normalizeFiles(files: ProjectFile[] | Record<string, string>): Record<string, string> {
  if (Array.isArray(files)) {
    const result: Record<string, string> = {};
    for (const file of files) {
      const cleanPath = file.path.replace(/^\//, '');
      result[cleanPath] = file.content;
    }
    return result;
  }
  return files;
}

// Navigation script
const NAVIGATION_SCRIPT = `
<script>
(function() {
  function notifyParent(type, path) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: type, path: path || window.location.pathname }, '*');
    }
  }
  notifyParent('PAGE_LOADED', window.location.pathname);
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'NAVIGATE') window.location.href = e.data.path;
    if (e.data.type === 'RELOAD') window.location.reload();
  });
})();
</script>
`;

function injectNavigationScript(html: string): string {
  if (html.includes('</body>')) {
    return html.replace('</body>', NAVIGATION_SCRIPT + '</body>');
  }
  return html + NAVIGATION_SCRIPT;
}

function processHTMLFile(htmlContent: string, cssContent: string, jsContent: string): string {
  let html = htmlContent;
  
  if (cssContent && !html.includes('<style>')) {
    const styleTag = `<style>\n${cssContent}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', styleTag + '\n</head>');
    } else {
      html = styleTag + '\n' + html;
    }
  }

  if (jsContent && !html.includes('<script>')) {
    const scriptTag = `<script>\n${jsContent}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', scriptTag + '\n</body>');
    } else {
      html = html + '\n' + scriptTag;
    }
  }

  return injectNavigationScript(html);
}

// Run shell command
async function runShellCommand(sandboxId: string, apiKey: string, cmd: string, background = false): Promise<{ success: boolean; output?: string; error?: string }> {
  const processUrl = `https://api.e2b.dev/sandboxes/${sandboxId}/commands`;
  
  const response = await fetch(processUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      cmd: cmd,
      background: background,
      envs: {},
    }),
  });

  if (response.ok) {
    const result = await response.json();
    return { success: true, output: result.stdout || result.output };
  }

  const errorText = await response.text().catch(() => '(no body)');
  return { success: false, error: errorText };
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
    const fileCount = Object.keys(normalizedFiles).length;
    console.log('[update-sandbox] Updating', fileCount, 'files in sandbox:', sandboxId);

    // Check if sandbox exists
    const checkResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
      method: 'GET',
      headers: { 'X-API-Key': E2B_API_KEY },
    });

    if (!checkResponse.ok) {
      console.log('[update-sandbox] Sandbox not found or expired');
      return new Response(
        JSON.stringify({ success: false, expired: true, error: 'Sandbox expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PUBLIC_DIR = '/home/user/public';

    // Extract file types
    const cssFile = Object.entries(normalizedFiles).find(([path]) => path.includes('style'));
    const jsFile = Object.entries(normalizedFiles).find(([path]) => path.endsWith('.js'));
    const cssContent = cssFile?.[1] || '';
    const jsContent = jsFile?.[1] || '';

    // Build Python script to update files
    let pythonScript = `
import os
os.makedirs("${PUBLIC_DIR}", exist_ok=True)
`;

    for (const [path, content] of Object.entries(normalizedFiles)) {
      if (path.endsWith('.html')) {
        const processedHTML = processHTMLFile(content, cssContent, jsContent);
        const cleanPath = path.replace(/^\//, '');
        const escapedContent = processedHTML.replace(/'/g, "\\'").replace(/\n/g, '\\n');
        
        pythonScript += `
with open("${PUBLIC_DIR}/${cleanPath}", "w", encoding="utf-8") as f:
    f.write('${escapedContent}')
print("Updated: ${cleanPath}")
`;
      }
    }

    pythonScript += 'print("FILES_UPDATED")';

    // Write and execute the update script
    const scriptPath = '/home/user/update.py';
    const writeScriptCmd = `cat > ${scriptPath} << 'SCRIPT_EOF'
${pythonScript}
SCRIPT_EOF`;
    
    await runShellCommand(sandboxId, E2B_API_KEY, writeScriptCmd, false);
    const execResult = await runShellCommand(sandboxId, E2B_API_KEY, `python3 ${scriptPath}`, false);
    
    console.log('[update-sandbox] Update result:', execResult);

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
