import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  name: string;
  content: string;
  type: 'text' | 'binary';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, projectFiles, projectName } = await req.json();

    if (!sessionId || !projectFiles || !projectName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, projectFiles, projectName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Publishing project to KV: ${projectName} (${projectFiles.length} files)`);

    // Récupérer les secrets Cloudflare
    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const kvNamespaceId = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

    if (!cloudflareApiToken || !cloudflareAccountId || !kvNamespaceId) {
      console.error('❌ Missing Cloudflare credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Cloudflare credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();

    // Publier tous les fichiers en parallèle pour une vitesse maximale
    const publishPromises = projectFiles.map(async (file: ProjectFile) => {
      const kvKey = `${projectName}:${file.name}`;
      
      console.log(`📤 Uploading to KV: ${kvKey}`);
      
      // Préparer le contenu
      let content: string | Uint8Array = file.content;
      
      // Si c'est du binaire, décoder le base64
      if (file.type === 'binary') {
        try {
          // Supprimer le préfixe data:image/... si présent
          const base64Content = file.content.includes('base64,')
            ? file.content.split('base64,')[1]
            : file.content;
          
          // Décoder le base64
          content = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
        } catch (error) {
          console.error(`❌ Error decoding base64 for ${kvKey}:`, error);
          throw new Error(`Failed to decode base64 for ${file.name}`);
        }
      }

      // Uploader vers KV via l'API Cloudflare
      const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/storage/kv/namespaces/${kvNamespaceId}/values/${encodeURIComponent(kvKey)}`;
      
      const response = await fetch(kvUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': file.type === 'binary' ? 'application/octet-stream' : 'text/plain',
        },
        body: content,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ KV upload failed for ${kvKey}:`, response.status, errorText);
        throw new Error(`Failed to upload ${file.name} to KV: ${response.status}`);
      }

      console.log(`✅ Uploaded to KV: ${kvKey}`);
      return { success: true, file: file.name };
    });

    // Attendre que tous les fichiers soient uploadés
    const results = await Promise.all(publishPromises);
    const uploadTime = Date.now() - startTime;

    console.log(`✅ All files uploaded to KV in ${uploadTime}ms`);

    // Construire l'URL publique
    const publicUrl = `https://${projectName}.builtbymagellan.com`;

    // Mettre à jour la session avec l'URL publique
    const { error: updateError } = await supabase
      .from('build_sessions')
      .update({ 
        public_url: publicUrl,
        cloudflare_project_name: projectName,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('❌ Error updating session:', updateError);
    }

    // Mettre à jour ou créer l'entrée published_projects
    const { data: existingProject } = await supabase
      .from('published_projects')
      .select('*')
      .eq('build_session_id', sessionId)
      .maybeSingle();

    if (existingProject) {
      await supabase
        .from('published_projects')
        .update({
          subdomain: projectName,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingProject.id);
    } else {
      await supabase
        .from('published_projects')
        .insert({
          build_session_id: sessionId,
          subdomain: projectName
        });
    }

    // Déclencher la capture de screenshot en arrière-plan (fire-and-forget)
    supabase.functions.invoke('generate-screenshot', {
      body: { 
        sessionId,
        url: publicUrl
      }
    }).catch(err => console.error('Screenshot generation failed:', err));

    console.log(`✅ Project published successfully: ${publicUrl} (${uploadTime}ms)`);

    return new Response(
      JSON.stringify({ 
        success: true,
        publicUrl,
        projectName,
        filesUploaded: results.length,
        uploadTime: `${uploadTime}ms`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in publish-to-kv function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
