import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📝 Publishing project for session:', sessionId);

    // Récupérer les informations du projet
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('❌ Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer le sous-domaine à partir du titre
    const subdomain = (session.title || 'mon-projet')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    console.log('🌐 Generated subdomain:', subdomain);

    // Vérifier si le projet est déjà publié
    const { data: existingProject } = await supabase
      .from('published_projects')
      .select('*')
      .eq('build_session_id', sessionId)
      .maybeSingle();

    const publicUrl = `https://${subdomain}.builtbymagellan.com`;

    if (existingProject) {
      // Mettre à jour le projet existant
      console.log('🔄 Updating existing published project');
      
      const { error: updateError } = await supabase
        .from('published_projects')
        .update({
          subdomain: subdomain,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingProject.id);

      if (updateError) {
        console.error('❌ Error updating published project:', updateError);
      }
    } else {
      // Créer un nouveau projet publié
      console.log('✨ Creating new published project');
      
      const { error: insertError } = await supabase
        .from('published_projects')
        .insert({
          build_session_id: sessionId,
          subdomain: subdomain
        });

      if (insertError) {
        console.error('❌ Error creating published project:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to publish project' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mettre à jour l'URL publique dans build_sessions
    const { error: updateSessionError } = await supabase
      .from('build_sessions')
      .update({ public_url: publicUrl })
      .eq('id', sessionId);

    if (updateSessionError) {
      console.error('❌ Error updating session with public URL:', updateSessionError);
    }

    console.log('✅ Project published successfully:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        publicUrl,
        subdomain 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in publish-project function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
