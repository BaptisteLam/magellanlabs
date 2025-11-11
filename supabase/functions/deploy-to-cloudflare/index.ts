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

    // Verify JWT and get user
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

    // Get session data
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

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Create unique project name
    const baseTitle = session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site';
    const uniqueId = sessionId.slice(0, 8);
    const projectName = `${baseTitle}-${uniqueId}`;
    
    let cloudflareProjectName = session.cloudflare_project_name;
    
    // Create project if it doesn't exist
    if (!cloudflareProjectName) {
      console.log('🔨 Creating Cloudflare Pages project...');
      
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
        const errorText = await createProjectResponse.text();
        console.error('❌ Failed to create project:', errorText);
        throw new Error(`Failed to create Cloudflare project: ${errorText}`);
      }

      const projectData = await createProjectResponse.json();
      cloudflareProjectName = projectData.result.name;
      console.log('✅ Project created:', cloudflareProjectName);
    }

    // Inject GA4 tracking if configured
    let modifiedProjectFiles = [...projectFiles];
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
      
      const htmlFileIndex = modifiedProjectFiles.findIndex((f: ProjectFile) => f.name === 'index.html');
      if (htmlFileIndex !== -1) {
        const originalHtml = modifiedProjectFiles[htmlFileIndex].content;
        let modifiedHtml = originalHtml;
        
        if (originalHtml.includes('</head>')) {
          modifiedHtml = originalHtml.replace('</head>', `${gaScript}\n</head>`);
        } else if (originalHtml.includes('<body')) {
          modifiedHtml = originalHtml.replace('<body', `${gaScript}\n<body`);
        } else {
          modifiedHtml = gaScript + '\n' + originalHtml;
        }
        
        modifiedProjectFiles[htmlFileIndex] = {
          ...modifiedProjectFiles[htmlFileIndex],
          content: modifiedHtml
        };
      }
    }

    // Prepare files for deployment
    const formData = new FormData();
    
    // Build manifest
    const manifest: Record<string, string> = {};
    modifiedProjectFiles.forEach((file: ProjectFile, index: number) => {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      manifest[fileName] = `/${index}`;
      
      // Add file to form data
      if (file.content.startsWith('data:')) {
        // Handle base64 files (like favicon)
        const base64Data = file.content.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const blob = new Blob([binaryData]);
        formData.append(index.toString(), blob, fileName);
      } else {
        // Text files
        const blob = new Blob([file.content], { type: 'text/plain' });
        formData.append(index.toString(), blob, fileName);
      }
    });
    
    formData.append('manifest', JSON.stringify(manifest));

    console.log('🚀 Deploying to Cloudflare Pages...');
    
    // Deploy to Cloudflare Pages
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${cloudflareProjectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: formData,
      }
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      throw new Error(`Deployment failed: ${errorText}`);
    }

    const deployResult = await deployResponse.json();
    console.log('✅ Deployed to Cloudflare Pages:', deployResult);

    const deploymentUrl = deployResult.result.url || `https://${cloudflareProjectName}.pages.dev`;

    // Update session
    const { error: updateError } = await supabaseAdmin
      .from('build_sessions')
      .update({
        cloudflare_project_name: cloudflareProjectName,
        cloudflare_deployment_url: deploymentUrl,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update session:', updateError);
    }

    // Create or update website entry
    console.log('📝 Creating/updating website entry...');
    
    const htmlFile = modifiedProjectFiles.find((f: ProjectFile) => f.name === 'index.html');
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
          cloudflare_project_name: cloudflareProjectName,
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
          cloudflare_project_name: cloudflareProjectName,
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
    
    // Link build_session to website
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

    console.log('✅ Deployment successful:', deploymentUrl);

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

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        projectName: cloudflareProjectName,
        websiteId: websiteId || null,
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
