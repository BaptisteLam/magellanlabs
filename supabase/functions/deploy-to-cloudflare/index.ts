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

    console.log('📦 Deploying project to Cloudflare Pages...');
    
    const GA_MEASUREMENT_ID = Deno.env.get('GA_MEASUREMENT_ID');
    console.log('GA4 Measurement ID configured:', !!GA_MEASUREMENT_ID);

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

    // Inject GA4 script if configured
    let modifiedFiles = [...projectFiles];
    if (GA_MEASUREMENT_ID) {
      console.log('📊 Injecting GA4 tracking script...');
      
      const gaScript = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}', {
    'page_path': window.location.pathname,
    'custom_map': {'dimension1': 'hostname'}
  });
  gtag('event', 'page_view', {
    'hostname': window.location.hostname
  });
</script>`;
      
      const htmlFileIndex = modifiedFiles.findIndex((f: ProjectFile) => f.name === 'index.html');
      if (htmlFileIndex !== -1) {
        const originalHtml = modifiedFiles[htmlFileIndex].content;
        
        let updatedHtml = originalHtml;
        if (originalHtml.includes('</head>')) {
          updatedHtml = originalHtml.replace('</head>', `${gaScript}\n</head>`);
        } else if (originalHtml.includes('<body')) {
          updatedHtml = originalHtml.replace('<body', `${gaScript}\n<body`);
        } else {
          updatedHtml = gaScript + '\n' + originalHtml;
        }
        
        modifiedFiles[htmlFileIndex] = {
          ...modifiedFiles[htmlFileIndex],
          content: updatedHtml
        };
      }
    }

    const baseTitle = session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site';
    const uniqueId = sessionId.slice(0, 8);
    const projectName = session.cloudflare_project_name || `${baseTitle}-${uniqueId}`;
    
    console.log('🚀 Deploying to Cloudflare Pages project:', projectName);
    
    // Helper function to calculate SHA-256 hash
    async function calculateSHA256(content: string): Promise<string> {
      const encoder = new TextEncoder();
      let data: Uint8Array<ArrayBuffer>;
      
      if (content.startsWith('data:')) {
        // Binary file - decode base64
        const base64Data = content.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        data = bytes;
      } else {
        // Text file
        data = encoder.encode(content);
      }
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Prepare manifest with SHA-256 hashes
    console.log('📋 Calculating file hashes...');
    const manifest: Record<string, string> = {};
    
    for (const file of modifiedFiles) {
      const fileName = file.name.startsWith('/') ? file.name : `/${file.name}`;
      const hash = await calculateSHA256(file.content);
      manifest[fileName] = hash;
    }
    
    console.log('📋 Manifest created with', Object.keys(manifest).length, 'files');
    console.log('📋 Sample manifest entries:', JSON.stringify(Object.entries(manifest).slice(0, 2), null, 2));

    // Validate manifest is not empty
    if (Object.keys(manifest).length === 0) {
      throw new Error('Manifest is empty - no files to deploy');
    }

    // Try to deploy via direct upload API
    console.log('📤 Deploying via Cloudflare Pages Direct Upload...');
    
    let deployResult;
    let projectExists = true;
    
    // First, check if project exists by trying to get it
    const checkProjectResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );
    
    if (checkProjectResponse.status === 404) {
      projectExists = false;
      console.log('📝 Project does not exist, creating new Cloudflare Pages project...');
      
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
        console.error('❌ Failed to create project:', createError);
        throw new Error(`Failed to create Cloudflare Pages project: ${createError}`);
      }
      
      console.log('✅ Project created successfully');
    } else if (checkProjectResponse.ok) {
      console.log('✅ Project already exists');
    } else {
      const error = await checkProjectResponse.text();
      console.error('❌ Failed to check project:', error);
      throw new Error(`Failed to check project: ${error}`);
    }
    
    // Step 1: Create deployment with manifest to get upload token
    console.log('📤 Step 1: Creating deployment with manifest...');

    const deployPayload = {
      manifest: manifest
    };

    console.log('📤 Payload structure:', JSON.stringify({
      hasManifest: !!deployPayload.manifest,
      manifestKeys: Object.keys(deployPayload.manifest || {}).length
    }));

    // Log the full payload for debugging (first 500 chars)
    const payloadString = JSON.stringify(deployPayload);
    console.log('📤 Full payload (first 500 chars):', payloadString.substring(0, 500));
    console.log('📤 Payload byte length:', new TextEncoder().encode(payloadString).length);

    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: payloadString,
      }
    );
    
    if (!deployResponse.ok) {
      const deployError = await deployResponse.text();
      console.error('❌ Deployment creation failed:', deployError);
      console.error('❌ Request details - Endpoint:', `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`);
      console.error('❌ Request details - Headers:', JSON.stringify({ 'Content-Type': 'application/json' }));
      console.error('❌ Request details - Payload preview:', payloadString.substring(0, 200));
      throw new Error(`Deployment creation failed: ${deployError}`);
    }
    
    deployResult = await deployResponse.json();
    const uploadToken = deployResult.result?.jwt;
    const deploymentId = deployResult.result?.id;
    
    console.log('✅ Deployment created:', deploymentId);
    
    if (!uploadToken) {
      throw new Error('No upload token received from Cloudflare');
    }
    
    // Step 2: Upload each file individually
    console.log('📤 Step 2: Uploading files...');
    let uploadedCount = 0;
    
    for (const file of modifiedFiles) {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      const hash = manifest[`/${fileName}`];
      
      let fileData: Uint8Array<ArrayBuffer>;
      if (file.content.startsWith('data:')) {
        // Binary file
        const base64Data = file.content.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileData = bytes;
      } else {
        // Text file
        const encoder = new TextEncoder();
        fileData = encoder.encode(file.content);
      }
      
      const uploadResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments/${deploymentId}/files/${hash}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${uploadToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: fileData.buffer,
        }
      );
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        console.error(`❌ Failed to upload ${fileName}:`, uploadError);
        throw new Error(`Failed to upload ${fileName}: ${uploadError}`);
      }
      
      uploadedCount++;
      if (uploadedCount % 5 === 0) {
        console.log(`📤 Uploaded ${uploadedCount}/${modifiedFiles.length} files...`);
      }
    }
    
    console.log('✅ All files uploaded:', uploadedCount);

    const deploymentUrl = deployResult.result?.url || `https://${projectName}.pages.dev`;

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
    
    const htmlFile = modifiedFiles.find((f: ProjectFile) => f.name === 'index.html');
    const htmlContent = htmlFile?.content || '';
    
    const { data: existingWebsite } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', session.title)
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
        state: deployResult.result?.latest_stage?.status || 'active',
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
