import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const R2_BUCKET_URL = 'https://e9302a89deb439b6ea6652a9b0ccd8d1.r2.cloudflarestorage.com/magellan-versions';
const MAX_VERSIONS = 50;

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, projectFiles, message = 'Auto-save' } = await req.json();

    if (!sessionId || !projectFiles) {
      return new Response(JSON.stringify({ error: 'sessionId and projectFiles required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Sync preview for session:', sessionId);
    console.log('📁 Files to sync:', Object.keys(projectFiles).length);

    // Get Cloudflare credentials
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      console.error('❌ Missing Cloudflare credentials');
      return new Response(JSON.stringify({ error: 'Cloudflare credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== PHASE 1: Upload to KV (real-time preview) =====
    const uploadPromises = Object.entries(projectFiles).map(async ([path, content]) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const kvKey = `${sessionId}:${normalizedPath}`;
      
      console.log(`  📤 Uploading to KV: ${kvKey}`);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(kvKey)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: content as string,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to upload ${path}:`, errorText);
        throw new Error(`Failed to upload ${path}: ${errorText}`);
      }

      return { path, success: true };
    });

    const kvResults = await Promise.all(uploadPromises);
    console.log('✅ KV files synced:', kvResults.length);

    // ===== PHASE 2: Save version to R2 =====
    const versionId = `v${Date.now()}`;
    const versionData = {
      id: versionId,
      timestamp: Date.now(),
      message,
      files: projectFiles,
      filesCount: Object.keys(projectFiles).length,
    };

    // Upload version snapshot to R2
    const versionPath = `projects/${sessionId}/versions/${versionId}.json`;
    console.log(`📦 Saving version to R2: ${versionPath}`);
    
    const r2VersionResponse = await fetch(
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

    if (!r2VersionResponse.ok) {
      const errorText = await r2VersionResponse.text();
      console.error('⚠️ R2 version upload failed (non-blocking):', errorText);
      // Continue without R2 versioning - KV sync still works
    } else {
      console.log('✅ Version saved to R2:', versionId);
    }

    // ===== PHASE 3: Update metadata.json =====
    const metadataPath = `projects/${sessionId}/metadata.json`;
    
    // Try to get existing metadata
    let metadata: ProjectMetadata = { versions: [], lastUpdated: Date.now() };
    
    try {
      const metadataResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(metadataPath)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          },
        }
      );
      
      if (metadataResponse.ok) {
        metadata = await metadataResponse.json();
        console.log('📋 Loaded existing metadata:', metadata.versions.length, 'versions');
      }
    } catch (e) {
      console.log('📋 No existing metadata, creating new');
    }

    // Add new version to metadata
    const newVersionMeta: VersionMetadata = {
      id: versionId,
      timestamp: Date.now(),
      message,
      filesCount: Object.keys(projectFiles).length,
    };
    
    metadata.versions.unshift(newVersionMeta);
    metadata.lastUpdated = Date.now();

    // Limit to MAX_VERSIONS
    if (metadata.versions.length > MAX_VERSIONS) {
      const toDelete = metadata.versions.slice(MAX_VERSIONS);
      metadata.versions = metadata.versions.slice(0, MAX_VERSIONS);
      
      // Delete old versions from R2 (async, non-blocking)
      for (const oldVersion of toDelete) {
        const oldPath = `projects/${sessionId}/versions/${oldVersion.id}.json`;
        fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/magellan-versions/objects/${encodeURIComponent(oldPath)}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            },
          }
        ).catch(e => console.warn('⚠️ Failed to delete old version:', oldVersion.id));
      }
      console.log('🗑️ Cleaned up', toDelete.length, 'old versions');
    }

    // Save updated metadata
    const r2MetadataResponse = await fetch(
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

    if (!r2MetadataResponse.ok) {
      console.error('⚠️ R2 metadata update failed (non-blocking)');
    } else {
      console.log('✅ Metadata updated:', metadata.versions.length, 'versions');
    }

    // Build the preview URL
    const previewUrl = `https://${sessionId}.builtbymagellan.com`;

    return new Response(JSON.stringify({
      success: true,
      previewUrl,
      filesUploaded: kvResults.length,
      versionId,
      versionsCount: metadata.versions.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Sync error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
