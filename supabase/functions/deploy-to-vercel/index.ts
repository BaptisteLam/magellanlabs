import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

interface ProjectFile {
  name: string;
  content: string;
  type: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vercelToken = Deno.env.get('VERCEL_API_TOKEN');

    if (!vercelToken) {
      throw new Error('VERCEL_API_TOKEN non configuré');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autorisation requise');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Session non valide');
    }

    const { sessionId, projectFiles } = await req.json();

    if (!sessionId || !projectFiles) {
      throw new Error('Paramètres manquants');
    }

    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session introuvable');
    }

    // Inject GA4 if configured
    let modifiedFiles = [...projectFiles];
    if (session.ga_measurement_id) {
      modifiedFiles = projectFiles.map((file: ProjectFile) => {
        if (file.name === 'index.html' || file.name === '/index.html') {
          const gaScript = `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${session.ga_measurement_id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${session.ga_measurement_id}');
</script>`;
          return {
            ...file,
            content: file.content.replace('</head>', `${gaScript}\n</head>`)
          };
        }
        return file;
      });
    }

    // Prepare files for Vercel deployment
    const vercelFiles = [];
    const encoder = new TextEncoder();
    for (const file of modifiedFiles) {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      const uint8Array = encoder.encode(file.content);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      vercelFiles.push({
        file: fileName,
        data: base64
      });
    }

    // Create project name from session title
    const projectName = session.title
      ? session.title.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 50)
      : `project-${sessionId.substring(0, 8)}`;

    // Deploy to Vercel
    const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        files: vercelFiles,
        projectSettings: {
          framework: null,
        },
        target: 'production',
      }),
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('Vercel deployment error:', errorText);
      throw new Error(`Erreur Vercel: ${deployResponse.statusText}`);
    }

    const deployment = await deployResponse.json();
    const deploymentUrl = `https://${deployment.url}`;

    // Update build session
    await supabase
      .from('build_sessions')
      .update({
        vercel_deployment_id: deployment.id,
        vercel_url: deploymentUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Create or update website record
    const { data: existingWebsite } = await supabase
      .from('websites')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (existingWebsite) {
      await supabase
        .from('websites')
        .update({
          url: deploymentUrl,
          vercel_deployment_id: deployment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWebsite.id);
    } else {
      const { data: newWebsite } = await supabase
        .from('websites')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          title: session.title || 'Site sans titre',
          url: deploymentUrl,
          vercel_deployment_id: deployment.id,
        })
        .select()
        .single();

      if (newWebsite) {
        // Generate screenshot asynchronously
        supabase.functions
          .invoke('generate-screenshot', {
            body: {
              websiteId: newWebsite.id,
              url: deploymentUrl,
            },
          })
          .catch((err) => console.error('Screenshot generation failed:', err));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        deploymentId: deployment.id,
        state: deployment.readyState || 'READY',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Deployment error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur de déploiement',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
