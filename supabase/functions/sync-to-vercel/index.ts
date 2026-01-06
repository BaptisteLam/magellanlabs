import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate SHA1 hash for Vercel file upload
async function calculateSHA1(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Sanitize project files (remove markdown code blocks, etc.)
function sanitizeProjectFiles(files: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    let cleanContent = content;
    // Remove markdown code blocks
    cleanContent = cleanContent.replace(/^```[\w]*\n?/gm, '');
    cleanContent = cleanContent.replace(/```$/gm, '');
    // Remove excessive blank lines
    cleanContent = cleanContent.replace(/\n{4,}/g, '\n\n\n');
    sanitized[path] = cleanContent;
  }

  return sanitized;
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 sync-to-vercel: Starting...');

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`👤 User authenticated: ${user.id.substring(0, 8)}...`);

    // Get Vercel credentials
    const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN');
    const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID');

    if (!VERCEL_API_TOKEN) {
      console.error('❌ VERCEL_API_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'VERCEL_API_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { sessionId, projectFiles } = await req.json();

    if (!sessionId || !projectFiles || Object.keys(projectFiles).length === 0) {
      console.error('❌ Missing sessionId or projectFiles');
      return new Response(
        JSON.stringify({ error: 'Missing sessionId or projectFiles' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fileCount = Object.keys(projectFiles).length;
    console.log(`📁 Processing ${fileCount} files for session: ${sessionId.substring(0, 8)}...`);

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('❌ Session not found or unauthorized');
      return new Response(JSON.stringify({ error: 'Session not found or unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize files
    const sanitizedFiles = sanitizeProjectFiles(projectFiles);

    // Step 1: Upload files to Vercel and calculate hashes
    const fileHashes: Record<string, string> = {};
    let uploadedCount = 0;
    let existingCount = 0;

    const uploadPromises: Promise<void>[] = [];

    for (const [filePath, content] of Object.entries(sanitizedFiles)) {
      const uploadFile = async () => {
        const sha = await calculateSHA1(content);
        fileHashes[filePath] = sha;

        // Upload file to Vercel
        const uploadUrl = VERCEL_TEAM_ID
          ? `https://api.vercel.com/v2/files?teamId=${VERCEL_TEAM_ID}`
          : 'https://api.vercel.com/v2/files';

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${VERCEL_API_TOKEN}`,
            'Content-Type': 'application/octet-stream',
            'x-vercel-digest': sha,
          },
          body: content,
        });

        if (uploadResponse.status === 409) {
          // File already exists (same content)
          existingCount++;
        } else if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error(`❌ Failed to upload ${filePath}:`, errorText);
        } else {
          uploadedCount++;
        }
      };

      uploadPromises.push(uploadFile());
    }

    await Promise.all(uploadPromises);
    console.log(`📤 Files: ${uploadedCount} uploaded, ${existingCount} already exist (unchanged)`);

    // Step 2: Create deployment
    const projectName = `magellan-${sessionId.substring(0, 8)}`;
    
    // Build files array for deployment
    const deploymentFiles = Object.entries(fileHashes).map(([file, sha]) => ({
      file: file.startsWith('/') ? file : `/${file}`,
      sha,
    }));

    const deployUrl = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}`
      : 'https://api.vercel.com/v13/deployments';

    // Add vercel.json for SPA routing if not present
    const vercelConfigContent = JSON.stringify({
      rewrites: [{ source: "/(.*)", destination: "/" }]
    });
    const vercelConfigSha = await calculateSHA1(vercelConfigContent);
    
    // Upload vercel.json
    const vercelConfigUrl = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v2/files?teamId=${VERCEL_TEAM_ID}`
      : 'https://api.vercel.com/v2/files';
    
    await fetch(vercelConfigUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'x-vercel-digest': vercelConfigSha,
      },
      body: vercelConfigContent,
    });
    
    // Add vercel.json to deployment files
    deploymentFiles.push({ file: '/vercel.json', sha: vercelConfigSha });

    const deploymentPayload = {
      name: projectName,
      files: deploymentFiles,
      projectSettings: {
        framework: 'vite',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        installCommand: 'npm install',
      },
    };

    console.log('🚀 Creating Vercel deployment...');
    const deployResponse = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deploymentPayload),
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Vercel deployment failed', details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const deployment = await deployResponse.json();
    const previewUrl = `https://${deployment.url}`;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Deployment created: ${deployment.url}`);
    console.log(`⏱️ Total time: ${totalTime}ms`);
    console.log(`📊 Summary: ${fileCount} files, ${uploadedCount} new, ${existingCount} unchanged`);

    // Update session with public URL
    await supabase
      .from('build_sessions')
      .update({
        public_url: previewUrl,
        project_files: Object.entries(sanitizedFiles).map(([path, content]) => ({
          path,
          content,
        })),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        previewUrl,
        deploymentId: deployment.id,
        deploymentUrl: deployment.url,
        filesCount: fileCount,
        filesUploaded: uploadedCount,
        filesUnchanged: existingCount,
        status: deployment.readyState || 'BUILDING',
        duration: totalTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ sync-to-vercel error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
