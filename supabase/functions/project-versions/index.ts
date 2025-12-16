import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VersionMetadata {
  id: string;
  timestamp: number;
  message: string;
  filesCount: number;
}

interface ProjectMetadata {
  versions: VersionMetadata[];
  lastUpdated: number;
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

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      // GET: List versions for a project
      const url = new URL(req.url);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'sessionId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user owns this session
      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get metadata from R2
      const metadataPath = `projects/${sessionId}/metadata.json`;
      console.log('📋 Fetching versions for:', sessionId);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(metadataPath)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        console.log('📋 No versions found for session:', sessionId);
        return new Response(JSON.stringify({ versions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const metadata: ProjectMetadata = await response.json();
      console.log('✅ Found', metadata.versions.length, 'versions');

      return new Response(JSON.stringify({ versions: metadata.versions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (req.method === 'POST') {
      // POST: Create a named version snapshot
      const { sessionId, message } = await req.json();

      if (!sessionId || !message) {
        return new Response(JSON.stringify({ error: 'sessionId and message required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user owns this session and get project files
      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .select('id, project_files')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Parse project files
      let projectFiles: Record<string, string> = {};
      if (session.project_files) {
        if (Array.isArray(session.project_files)) {
          session.project_files.forEach((f: any) => {
            if (f.path && f.content) projectFiles[f.path] = f.content;
          });
        } else if (typeof session.project_files === 'object') {
          projectFiles = session.project_files as Record<string, string>;
        }
      }

      if (Object.keys(projectFiles).length === 0) {
        return new Response(JSON.stringify({ error: 'No files to save' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create version
      const versionId = `v${Date.now()}`;
      const versionData = {
        id: versionId,
        timestamp: Date.now(),
        message,
        files: projectFiles,
        filesCount: Object.keys(projectFiles).length,
      };

      // Upload to R2
      const versionPath = `projects/${sessionId}/versions/${versionId}.json`;
      console.log('📦 Creating named version:', message);

      const r2Response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(versionPath)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(versionData),
        }
      );

      if (!r2Response.ok) {
        const error = await r2Response.text();
        console.error('❌ R2 upload failed:', error);
        return new Response(JSON.stringify({ error: 'Failed to save version' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update metadata
      const metadataPath = `projects/${sessionId}/metadata.json`;
      let metadata: ProjectMetadata = { versions: [], lastUpdated: Date.now() };

      try {
        const metaResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(metadataPath)}`,
          {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
          }
        );
        if (metaResponse.ok) {
          metadata = await metaResponse.json();
        }
      } catch (e) {
        console.log('📋 Creating new metadata');
      }

      metadata.versions.unshift({
        id: versionId,
        timestamp: Date.now(),
        message,
        filesCount: Object.keys(projectFiles).length,
      });
      metadata.lastUpdated = Date.now();

      // Limit versions to 10
      if (metadata.versions.length > 10) {
        metadata.versions = metadata.versions.slice(0, 10);
      }

      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(metadataPath)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        }
      );

      console.log('✅ Version created:', versionId);

      return new Response(JSON.stringify({ 
        success: true, 
        versionId,
        versionsCount: metadata.versions.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
