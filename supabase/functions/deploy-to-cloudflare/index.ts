import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  name: string;
  content: string;
  type: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Lire le body UNE SEULE FOIS
    const requestBody = await req.json();
    const { sessionId, projectFiles } = requestBody;
    
    if (!sessionId || !projectFiles) {
      console.error('❌ Missing sessionId or projectFiles');
      return new Response(
        JSON.stringify({ error: 'Session ID and project files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Deploying project to Cloudflare Worker...');
    console.log('Session ID:', sessionId);
    console.log('Files count:', projectFiles.length);

    // Get session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('build_sessions')
      .select('cloudflare_project_name, cloudflare_deployment_url, title')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      throw new Error(`Failed to get session: ${sessionError.message}`);
    }

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Generate worker name
    const workerName = session.cloudflare_project_name || 
      `trinity-${session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site'}-${sessionId.slice(0, 8)}`;

    console.log('Worker name:', workerName);

    // Créer le Worker script qui servira les fichiers statiques
    const filesMap: Record<string, string> = {};
    projectFiles.forEach((file: ProjectFile) => {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      filesMap[fileName] = file.content;
    });

    // Script Worker qui sert les fichiers statiques
    const workerScript = `
const FILES = ${JSON.stringify(filesMap)};

const MIME_TYPES = {
  'html': 'text/html; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'js': 'application/javascript; charset=utf-8',
  'json': 'application/json; charset=utf-8',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
};

function getMimeType(path) {
  const ext = path.split('.').pop() || 'html';
  return MIME_TYPES[ext] || 'text/plain';
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    
    // Serve index.html for root path
    if (path === '/' || path === '') {
      path = 'index.html';
    } else {
      path = path.startsWith('/') ? path.slice(1) : path;
    }
    
    // Try to find the file
    const content = FILES[path];
    
    if (content) {
      return new Response(content, {
        headers: {
          'Content-Type': getMimeType(path),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // If not found and it's not a file extension, try serving index.html (SPA support)
    if (!path.includes('.') && FILES['index.html']) {
      return new Response(FILES['index.html'], {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
`;

    console.log('🚀 Deploying Worker...');
    
    // Deploy Worker using Cloudflare API
    const workerUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`;
    
    const deployResponse = await fetch(workerUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/javascript',
      },
      body: workerScript,
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      throw new Error(`Deployment failed: ${errorText}`);
    }

    const deployResult = await deployResponse.json();
    console.log('✅ Worker deployed:', deployResult);

    // Enable the worker on workers.dev subdomain
    const subdomainUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}/subdomain`;
    
    await fetch(subdomainUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true }),
    });

    const deploymentUrl = `https://${workerName}.${CLOUDFLARE_ACCOUNT_ID}.workers.dev`;

    // Update session
    const { error: updateError } = await supabaseClient
      .from('build_sessions')
      .update({
        cloudflare_project_name: workerName,
        cloudflare_deployment_url: deploymentUrl,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update session:', updateError);
    }

    console.log('✅ Deployment successful:', deploymentUrl);

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        projectName: workerName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
