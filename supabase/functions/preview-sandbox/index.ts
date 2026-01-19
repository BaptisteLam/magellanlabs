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

// Navigation script to inject into HTML files
const NAVIGATION_SCRIPT = `
<script>
(function() {
  function notifyParent(type, path) {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: type,
        path: path || window.location.pathname,
        title: document.title || 'Preview'
      }, '*');
    }
  }
  
  notifyParent('PAGE_LOADED', window.location.pathname);
  
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'NAVIGATE' && e.data.path) {
      window.location.href = e.data.path;
    }
    if (e.data.type === 'RELOAD') {
      window.location.reload();
    }
  });
  
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (link && link.href && link.href.startsWith(window.location.origin)) {
      e.preventDefault();
      window.parent.postMessage({ type: 'INTERNAL_NAVIGATION', path: link.pathname }, '*');
      window.location.href = link.href;
    }
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { notifyParent('PAGE_LOADED'); });
  }
  window.addEventListener('load', function() { notifyParent('PAGE_LOADED'); });
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
  
  // Inject CSS
  if (cssContent && !html.includes('<style>') && !html.includes('styles.css')) {
    const styleTag = `<style>\n${cssContent}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', styleTag + '\n</head>');
    } else {
      html = styleTag + '\n' + html;
    }
  }

  // Inject JS
  if (jsContent && !html.includes('<script>') && !html.includes('app.js')) {
    const scriptTag = `<script>\n${jsContent}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', scriptTag + '\n</body>');
    } else {
      html = html + '\n' + scriptTag;
    }
  }

  // Inject navigation script
  html = injectNavigationScript(html);

  return html;
}

// Escape content for Python triple-quoted string
function escapeForPython(content: string): string {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}

// Execute code via WebSocket-based code execution
async function executeCodeViaRPC(sandboxId: string, apiKey: string, code: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
  // Use the RPC endpoint for code execution
  const execUrl = `https://api.e2b.dev/sandboxes/${sandboxId}/code/execution`;
  
  console.log('[preview-sandbox] Executing code via RPC...');
  
  const response = await fetch(execUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      code: code,
      language: 'python',
    }),
  });

  if (response.ok) {
    const result = await response.json();
    console.log('[preview-sandbox] RPC execution result:', JSON.stringify(result));
    return { success: true, stdout: result.stdout, stderr: result.stderr };
  }

  const errorText = await response.text().catch(() => '(no body)');
  console.log('[preview-sandbox] RPC execution failed:', response.status, errorText);
  return { success: false, error: errorText };
}

// Alternative: Run shell command via process API
async function runShellCommand(sandboxId: string, apiKey: string, cmd: string, background = false): Promise<{ success: boolean; output?: string; error?: string }> {
  const processUrl = `https://api.e2b.dev/sandboxes/${sandboxId}/commands`;
  
  console.log('[preview-sandbox] Running command:', cmd.substring(0, 100) + '...');
  
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
    console.log('[preview-sandbox] Command result:', JSON.stringify(result).substring(0, 200));
    return { success: true, output: result.stdout || result.output };
  }

  const errorText = await response.text().catch(() => '(no body)');
  console.log('[preview-sandbox] Command failed:', response.status, errorText);
  return { success: false, error: errorText };
}

// Write file via filesystem API with multiple fallbacks
async function writeFileToSandbox(sandboxId: string, filePath: string, content: string, apiKey: string): Promise<boolean> {
  console.log('[preview-sandbox] Writing file:', filePath);
  
  // Method 1: Try filesystem API with base64
  const data = new TextEncoder().encode(content);
  const base64Content = btoa(String.fromCharCode(...data));
  
  const filesystemUrl = `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem`;
  
  // Try various formats
  const attempts = [
    { method: 'POST', body: { path: filePath, content: base64Content } },
    { method: 'PUT', body: { path: filePath, data: base64Content } },
    { method: 'POST', body: { files: [{ path: filePath, data: base64Content }] } },
  ];

  for (const attempt of attempts) {
    const res = await fetch(filesystemUrl, {
      method: attempt.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(attempt.body),
    });

    if (res.ok) {
      console.log('[preview-sandbox] File written via filesystem API');
      return true;
    }

    const errText = await res.text().catch(() => '(no body)');
    console.log(`[preview-sandbox] Filesystem attempt failed (${res.status}):`, errText.substring(0, 100));
  }

  // Method 2: Write via echo command (for small files)
  if (content.length < 5000) {
    // Escape for shell
    const shellEscaped = content
      .replace(/'/g, "'\\''")
      .replace(/\n/g, '\\n');
    
    const echoResult = await runShellCommand(sandboxId, apiKey, `echo '${shellEscaped}' > ${filePath}`, false);
    if (echoResult.success) {
      console.log('[preview-sandbox] File written via echo command');
      return true;
    }
  }

  // Method 3: Write via Python command
  const pythonCode = `
import os
os.makedirs(os.path.dirname("${filePath}"), exist_ok=True)
with open("${filePath}", "w", encoding="utf-8") as f:
    f.write("""${escapeForPython(content)}""")
print("Written: ${filePath}")
`;

  const pythonResult = await runShellCommand(sandboxId, apiKey, `python3 -c '${pythonCode.replace(/'/g, "'\\''")}'`, false);
  if (pythonResult.success) {
    console.log('[preview-sandbox] File written via Python');
    return true;
  }

  console.error('[preview-sandbox] All file write methods failed for:', filePath);
  return false;
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

    const body: RequestBody = await req.json();
    const { files, sessionId } = body;

    if (!files || (Array.isArray(files) && files.length === 0) || Object.keys(files).length === 0) {
      throw new Error('No files provided');
    }

    const normalizedFiles = normalizeFiles(files);
    const fileCount = Object.keys(normalizedFiles).length;
    console.log('[preview-sandbox] 1. Processing', fileCount, 'files');

    // Extract file types
    const htmlFiles = Object.entries(normalizedFiles).filter(([path]) => path.endsWith('.html'));
    const cssFile = Object.entries(normalizedFiles).find(([path]) => path.includes('style'));
    const jsFile = Object.entries(normalizedFiles).find(([path]) => path.endsWith('.js'));
    
    const cssContent = cssFile?.[1] || '';
    const jsContent = jsFile?.[1] || '';

    const PORT = 8000;
    const PUBLIC_DIR = '/home/user/public';

    // Create E2B sandbox
    console.log('[preview-sandbox] 2. Creating E2B sandbox...');
    const createResponse = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: 'base',
        timeout: 300,
        metadata: {
          sessionId: sessionId || 'preview',
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
    console.log('[preview-sandbox] 3. Sandbox created:', sandboxId);

    // Create public directory via command
    await runShellCommand(sandboxId, E2B_API_KEY, `mkdir -p ${PUBLIC_DIR}`, false);
    console.log('[preview-sandbox] 4. Public directory created');

    // Build Python script to write all files at once
    const writtenPages: string[] = [];
    
    let pythonScript = `
import os
os.makedirs("${PUBLIC_DIR}", exist_ok=True)
`;

    // If no HTML files, create a default index.html
    if (htmlFiles.length === 0) {
      const defaultHTML = processHTMLFile(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div id="app"><h1>Preview</h1><p>Aucun fichier HTML.</p></div>
</body>
</html>`, cssContent, jsContent);

      pythonScript += `
with open("${PUBLIC_DIR}/index.html", "w", encoding="utf-8") as f:
    f.write('''${defaultHTML.replace(/'/g, "\\'")}''')
print("Written: index.html")
`;
      writtenPages.push('/index.html');
    } else {
      for (const [path, content] of htmlFiles) {
        const processedHTML = processHTMLFile(content, cssContent, jsContent);
        const cleanPath = path.replace(/^\//, '');
        const escapedContent = processedHTML.replace(/'/g, "\\'").replace(/\n/g, '\\n');
        
        pythonScript += `
with open("${PUBLIC_DIR}/${cleanPath}", "w", encoding="utf-8") as f:
    f.write('${escapedContent}')
print("Written: ${cleanPath}")
`;
        writtenPages.push('/' + cleanPath);
      }
    }

    // Start HTTP server
    pythonScript += `
import threading
import http.server
import socketserver
import time

os.chdir("${PUBLIC_DIR}")

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server():
    with socketserver.TCPServer(("0.0.0.0", ${PORT}), QuietHandler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
time.sleep(2)
print("SERVER_READY on port ${PORT}")
`;

    console.log('[preview-sandbox] 5. Executing combined Python script...');
    
    // Save Python script to file and execute
    const scriptPath = '/home/user/setup.py';
    const scriptEscaped = pythonScript.replace(/'/g, "'\\''");
    
    // Write the script using cat with heredoc
    const writeScriptCmd = `cat > ${scriptPath} << 'SCRIPT_EOF'
${pythonScript}
SCRIPT_EOF`;
    
    await runShellCommand(sandboxId, E2B_API_KEY, writeScriptCmd, false);
    console.log('[preview-sandbox] 6. Setup script written');

    // Execute the script in background
    const execResult = await runShellCommand(sandboxId, E2B_API_KEY, `python3 ${scriptPath}`, true);
    console.log('[preview-sandbox] 7. Script execution result:', execResult);

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get host URL
    const previewUrl = `https://${sandboxId}-${PORT}.e2b.dev`;
    console.log('[preview-sandbox] 8. Preview URL:', previewUrl);

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        previewUrl,
        filesCount: fileCount,
        pages: writtenPages,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[preview-sandbox] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
