import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Starting data migration to Magellan...');

    // Client Lovable Cloud (source)
    const lovableClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Client Magellan (destination)
    const magellanUrl = Deno.env.get('MAGELLAN_URL') || 'https://qpqsmryanrlrqczerlig.supabase.co';
    const magellanServiceKey = Deno.env.get('MAGELLAN_SERVICE_ROLE_KEY')!;
    const magellanClient = createClient(magellanUrl, magellanServiceKey);

    // Vérifier l'authentification
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await lovableClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ User authenticated: ${user.id}`);

    const stats = {
      profiles: 0,
      projects: 0,
      build_sessions: 0,
      websites: 0,
      screenshots: 0,
      errors: [] as string[]
    };

    // 1. Migrer le profil utilisateur
    console.log('📋 Migrating profile...');
    const { data: profile } = await lovableClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      const { error: profileError } = await magellanClient
        .from('profiles')
        .upsert(profile, { onConflict: 'id' });
      
      if (profileError) {
        console.error('❌ Profile migration error:', profileError);
        stats.errors.push(`Profile: ${profileError.message}`);
      } else {
        stats.profiles++;
        console.log('✅ Profile migrated');
      }
    }

    // 2. Migrer les projets
    console.log('📋 Migrating projects...');
    const { data: projects } = await lovableClient
      .from('projects')
      .select('*')
      .eq('user_id', user.id);

    if (projects && projects.length > 0) {
      const { error: projectsError } = await magellanClient
        .from('projects')
        .upsert(projects, { onConflict: 'id' });
      
      if (projectsError) {
        console.error('❌ Projects migration error:', projectsError);
        stats.errors.push(`Projects: ${projectsError.message}`);
      } else {
        stats.projects = projects.length;
        console.log(`✅ ${projects.length} projects migrated`);
      }
    }

    // 3. Migrer les build_sessions
    console.log('📋 Migrating build sessions...');
    const { data: sessions } = await lovableClient
      .from('build_sessions')
      .select('*')
      .eq('user_id', user.id);

    if (sessions && sessions.length > 0) {
      const { error: sessionsError } = await magellanClient
        .from('build_sessions')
        .upsert(sessions, { onConflict: 'id' });
      
      if (sessionsError) {
        console.error('❌ Build sessions migration error:', sessionsError);
        stats.errors.push(`Build sessions: ${sessionsError.message}`);
      } else {
        stats.build_sessions = sessions.length;
        console.log(`✅ ${sessions.length} build sessions migrated`);
      }
    }

    // 4. Migrer les websites
    console.log('📋 Migrating websites...');
    const { data: websites } = await lovableClient
      .from('websites')
      .select('*')
      .eq('user_id', user.id);

    if (websites && websites.length > 0) {
      const { error: websitesError } = await magellanClient
        .from('websites')
        .upsert(websites, { onConflict: 'id' });
      
      if (websitesError) {
        console.error('❌ Websites migration error:', websitesError);
        stats.errors.push(`Websites: ${websitesError.message}`);
      } else {
        stats.websites = websites.length;
        console.log(`✅ ${websites.length} websites migrated`);
      }
    }

    // 5. Migrer les screenshots du bucket storage
    console.log('📸 Migrating screenshots...');
    const { data: files } = await lovableClient.storage
      .from('screenshots')
      .list();

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // Télécharger depuis Lovable Cloud
          const { data: fileData } = await lovableClient.storage
            .from('screenshots')
            .download(file.name);

          if (fileData) {
            // Uploader vers Magellan
            const { error: uploadError } = await magellanClient.storage
              .from('screenshots')
              .upload(file.name, fileData, {
                contentType: file.metadata?.mimetype || 'image/webp',
                upsert: true
              });

            if (uploadError) {
              console.error(`❌ Screenshot ${file.name} error:`, uploadError);
              stats.errors.push(`Screenshot ${file.name}: ${uploadError.message}`);
            } else {
              stats.screenshots++;
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`❌ Screenshot ${file.name} error:`, err);
          stats.errors.push(`Screenshot ${file.name}: ${errorMessage}`);
        }
      }
      console.log(`✅ ${stats.screenshots}/${files.length} screenshots migrated`);
    }

    console.log('✅ Migration completed!');
    console.log('📊 Stats:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration completed successfully',
        stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Migration error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
