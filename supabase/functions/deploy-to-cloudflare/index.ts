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

    // Function to create fresh FormData (needed because FormData can only be consumed once)
    function createFormData(files: ProjectFile[]) {
      const formData = new FormData();
      
      // Create manifest mapping file paths to their hashes
      const manifest: Record<string, string> = {};
      
      files.forEach((file: ProjectFile, index: number) => {
        const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
        const fileHash = `file-${index}`;
        
        // Add to manifest
        manifest[`/${fileName}`] = fileHash;
        
        // Add file to form data with hash as key
        if (file.content.startsWith('data:')) {
          const base64Data = file.content.split(',')[1];
          const mimeType = file.content.split(';')[0].split(':')[1];
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const blob = new Blob([binaryData], { type: mimeType });
          formData.append(fileHash, blob, fileName);
        } else {
          const blob = new Blob([file.content], { type: 'text/plain' });
          formData.append(fileHash, blob, fileName);
        }
      });
      
      // Add manifest as JSON string directly
      formData.append('manifest', JSON.stringify(manifest));
      
      return formData;
    }
    
    console.log('📋 Creating deployment manifest with', modifiedFiles.length, 'files');

    const baseTitle = session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site';
    const uniqueId = sessionId.slice(0, 8);
    const projectName = session.cloudflare_project_name || `${baseTitle}-${uniqueId}`;
    
    console.log('🚀 Deploying to Cloudflare Pages project:', projectName);
    
    // Deploy to Cloudflare Pages using Direct Upload
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: createFormData(modifiedFiles),
      }
    );

    let deployResult;
    
    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      
      // If project doesn't exist, create it first
      if (deployResponse.status === 404) {
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
          console.error('❌ Failed to create project:', createError);
          throw new Error(`Failed to create Cloudflare Pages project: ${createError}`);
        }
        
        console.log('✅ Project created, retrying deployment...');
        
        // Retry deployment
        const retryResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            },
            body: createFormData(modifiedFiles),
          }
        );
        
        if (!retryResponse.ok) {
          const retryError = await retryResponse.text();
          throw new Error(`Deployment failed after project creation: ${retryError}`);
        }
        
        deployResult = await retryResponse.json();
      } else {
        throw new Error(`Deployment failed: ${errorText}`);
      }
    } else {
      deployResult = await deployResponse.json();
    }

    console.log('✅ Deployed to Cloudflare Pages:', deployResult);

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
