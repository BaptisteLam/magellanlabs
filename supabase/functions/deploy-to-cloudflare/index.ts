import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
    console.log('🚀 Deploy to Cloudflare Pages function called');
    
    // Authentication
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Service key present:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    const requestBody = await req.json();
    const { sessionId, projectFiles } = requestBody;
    
    console.log('Session ID:', sessionId);
    console.log('Files count:', projectFiles?.length);
    
    if (!sessionId || !projectFiles) {
      console.error('❌ Missing sessionId or projectFiles');
      return new Response(
        JSON.stringify({ error: 'Session ID and project files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Deploying project directly to Cloudflare Pages...');

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('build_sessions')
      .select('cloudflare_project_name, cloudflare_deployment_url, title')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      throw new Error(`Failed to get session: ${sessionError.message}`);
    }

    console.log('Session data retrieved:', session?.title);

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Cloudflare credentials not configured');
    }

    const baseTitle = session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site';
    const uniqueId = sessionId.slice(0, 8);
    const projectName = session.cloudflare_project_name || `${baseTitle}-${uniqueId}`;
    
    console.log('🚀 Deploying directly to Cloudflare Pages project:', projectName);
    
    // Vérifier si le projet existe
    const checkProjectResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );
    
    // Créer le projet s'il n'existe pas
    if (!checkProjectResponse.ok && checkProjectResponse.status === 404) {
      console.log('📝 Creating new Cloudflare Pages project...');
      
      const createProjectResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: 'main',
          }),
        }
      );
      
      if (!createProjectResponse.ok) {
        const createError = await createProjectResponse.text();
        console.error('❌ Failed to create Cloudflare project:', createError);
        throw new Error(`Failed to create Cloudflare Pages project: ${createError}`);
      }
      
      console.log('✅ Cloudflare Pages project created');
    }

    // Préparer les fichiers pour l'upload direct
    console.log('📤 Uploading files to Cloudflare Pages...');
    
    const formData = new FormData();
    
    // Ajouter chaque fichier au FormData
    for (const file of projectFiles) {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      
      let blob: Blob;
      if (file.content.startsWith('data:')) {
        // Fichier binaire (image, etc.)
        const base64Data = file.content.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
      } else {
        // Fichier texte
        blob = new Blob([file.content], { type: file.type || 'text/plain' });
      }
      
      formData.append(fileName, blob, fileName);
    }
    
    // Créer un déploiement direct sur Cloudflare
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: formData,
      }
    );
    
    if (!deployResponse.ok) {
      const deployError = await deployResponse.text();
      console.error('❌ Failed to deploy:', deployError);
      throw new Error(`Failed to deploy to Cloudflare Pages: ${deployError}`);
    }
    
    const deployData = await deployResponse.json();
    const deploymentUrl = deployData.result?.url || `https://${projectName}.pages.dev`;
    
    console.log('✅ Deployed to Cloudflare:', deploymentUrl);

    // Update session
    const { error: updateError } = await supabaseAdmin
      .from('build_sessions')
      .update({
        cloudflare_project_name: projectName,
        cloudflare_deployment_url: deploymentUrl,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update session:', updateError);
    }

    // Create or update website entry
    console.log('📝 Creating/updating website entry...');
    
    const htmlFile = projectFiles.find((f: ProjectFile) => f.name === 'index.html');
    const htmlContent = htmlFile?.content || '';
    
    const { data: existingWebsite } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('build_session_id', sessionId)
      .maybeSingle();
    
    let websiteId: string;
    
    if (existingWebsite) {
      websiteId = existingWebsite.id;
      
      const { error: websiteUpdateError } = await supabaseAdmin
        .from('websites')
        .update({
          cloudflare_url: deploymentUrl,
          cloudflare_project_name: projectName,
          html_content: htmlContent,
          title: session.title || 'Sans titre',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWebsite.id);
      
      if (websiteUpdateError) {
        console.error('⚠️ Failed to update website:', websiteUpdateError);
      } else {
        console.log('✅ Website entry updated');
      }
    } else {
      const { data: newWebsite, error: websiteInsertError } = await supabaseAdmin
        .from('websites')
        .insert({
          user_id: user.id,
          title: session.title || 'Sans titre',
          cloudflare_url: deploymentUrl,
          cloudflare_project_name: projectName,
          html_content: htmlContent,
          build_session_id: sessionId,
        })
        .select('id')
        .single();
      
      if (websiteInsertError || !newWebsite) {
        console.error('⚠️ Failed to create website:', websiteInsertError);
        websiteId = '';
      } else {
        console.log('✅ Website entry created');
        websiteId = newWebsite.id;
      }
    }
    
    if (websiteId) {
      const { error: linkError } = await supabaseAdmin
        .from('build_sessions')
        .update({ website_id: websiteId })
        .eq('id', sessionId);
      
      if (linkError) {
        console.error('⚠️ Failed to link session to website:', linkError);
      } else {
        console.log('✅ Session linked to website');
      }
    }
    
    // Generate screenshot (fire and forget)
    console.log('📸 Generating screenshot...');
    
    const screenshotPromise = fetch(`${supabaseUrl}/functions/v1/generate-screenshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: deploymentUrl,
        sessionId: sessionId,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        console.error('⚠️ Screenshot generation failed:', error);
      } else {
        const data = await response.json();
        console.log('✅ Screenshot generated:', data?.thumbnailUrl);
      }
    }).catch((error) => {
      console.error('⚠️ Screenshot error:', error);
    });
    
    screenshotPromise;

    console.log('✅ Deployment successful:', deploymentUrl);

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        projectName: projectName,
        websiteId: websiteId || null,
        state: 'active',
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
