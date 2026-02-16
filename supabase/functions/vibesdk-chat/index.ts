import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * vibesdk-chat Edge Function
 *
 * Crée une session VibeSDK avec le prompt utilisateur ou envoie un message de suivi.
 * Gère le streaming SSE, le suivi des crédits, et la persistence en DB.
 *
 * POST /vibesdk-chat
 * Body: { prompt, sessionId, agentId?, isFollowUp? }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Parse body ----
    const { prompt, sessionId, agentId, isFollowUp } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Check credits ----
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: credits, error: creditsError } = await supabaseAdmin
      .rpc('check_user_credits', { p_user_id: user.id });

    if (creditsError) {
      console.error('[vibesdk-chat] Error checking credits:', creditsError);
    }

    const creditInfo = credits?.[0];
    if (creditInfo && !creditInfo.can_send) {
      return new Response(
        JSON.stringify({
          error: 'Message limit reached',
          plan: creditInfo.plan,
          messages_used: creditInfo.messages_used,
          messages_limit: creditInfo.messages_limit,
          cycle_reset: creditInfo.cycle_reset,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- VibeSDK API Key ----
    const VIBESDK_API_KEY = Deno.env.get('VIBESDK_API_KEY');
    if (!VIBESDK_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'VIBESDK_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const VIBESDK_BASE_URL = Deno.env.get('VIBESDK_BASE_URL') || 'https://build.cloudflare.dev';

    console.log(`[vibesdk-chat] User ${user.id} | Session ${sessionId} | Follow-up: ${!!isFollowUp} | Prompt: ${prompt.substring(0, 100)}...`);

    // ---- Call VibeSDK API ----
    let vibeResponse: Response;
    let vibeAgentId = agentId;

    if (isFollowUp && agentId) {
      // Envoyer un message de suivi à un agent existant
      vibeResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent/${agentId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VIBESDK_API_KEY}`,
        },
        body: JSON.stringify({
          message: prompt,
          type: 'user_suggestion',
        }),
      });
    } else {
      // Créer un nouvel agent/build
      vibeResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VIBESDK_API_KEY}`,
        },
        body: JSON.stringify({
          query: prompt,
          projectType: 'app',
          behaviorType: 'phasic',
        }),
      });
    }

    if (!vibeResponse.ok) {
      const errorText = await vibeResponse.text();
      console.error('[vibesdk-chat] VibeSDK API error:', vibeResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `VibeSDK API error: ${vibeResponse.status}`, details: errorText }),
        { status: vibeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vibeData = await vibeResponse.json();
    console.log('[vibesdk-chat] VibeSDK response received:', {
      agentId: vibeData.agentId || vibeData.id,
      hasFiles: !!vibeData.files,
      previewUrl: vibeData.previewUrl,
      status: vibeData.status,
    });

    // ---- Extract data from VibeSDK response ----
    vibeAgentId = vibeData.agentId || vibeData.id || agentId;

    // Récupérer les fichiers - VibeSDK peut retourner les fichiers directement
    // ou on doit les récupérer via un appel séparé
    let filesRecord: Record<string, string> = {};

    if (vibeData.files) {
      // Fichiers directement dans la réponse
      if (Array.isArray(vibeData.files)) {
        for (const file of vibeData.files) {
          const path = (file.path || file.name || '').startsWith('/') ? (file.path || file.name) : `/${file.path || file.name}`;
          filesRecord[path] = file.content;
        }
      } else if (typeof vibeData.files === 'object') {
        filesRecord = vibeData.files;
      }
    }

    // Si pas de fichiers dans la réponse initiale, essayer de les récupérer
    if (Object.keys(filesRecord).length === 0 && vibeAgentId) {
      try {
        // Attendre un moment pour que la génération se termine
        await new Promise(resolve => setTimeout(resolve, 2000));

        const filesResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent/${vibeAgentId}/status`, {
          headers: {
            'Authorization': `Bearer ${VIBESDK_API_KEY}`,
          },
        });

        if (filesResponse.ok) {
          const statusData = await filesResponse.json();
          if (statusData.files) {
            if (Array.isArray(statusData.files)) {
              for (const file of statusData.files) {
                const path = (file.path || file.name || '').startsWith('/') ? (file.path || file.name) : `/${file.path || file.name}`;
                filesRecord[path] = file.content;
              }
            } else if (typeof statusData.files === 'object') {
              filesRecord = statusData.files;
            }
          }
        }
      } catch (e) {
        console.warn('[vibesdk-chat] Could not fetch files from agent status:', e);
      }
    }

    const previewUrl = vibeData.previewUrl || null;

    // ---- Increment credits ----
    const { data: newCredits } = await supabaseAdmin
      .rpc('increment_messages_used', { p_user_id: user.id });

    // ---- Save generation to DB ----
    await supabaseAdmin.from('generations').insert({
      user_id: user.id,
      session_id: sessionId || null,
      vibesdk_session_id: vibeAgentId,
      prompt,
      code: JSON.stringify(filesRecord),
      preview_url: previewUrl,
      demo_url: previewUrl,
      status: 'completed',
      tokens_used: 0,
      created_at: new Date().toISOString(),
    });

    // ---- Update build session ----
    if (sessionId && Object.keys(filesRecord).length > 0) {
      const updateData: Record<string, unknown> = {
        project_files: filesRecord,
        vibesdk_session_id: vibeAgentId,
        updated_at: new Date().toISOString(),
      };

      // Utiliser le nom retourné par VibeSDK comme titre si disponible
      if (vibeData.name || vibeData.title) {
        const { data: currentSession } = await supabaseAdmin
          .from('build_sessions')
          .select('title')
          .eq('id', sessionId)
          .maybeSingle();

        if (!currentSession?.title || currentSession.title === sessionId) {
          updateData.title = vibeData.name || vibeData.title;
        }
      }

      await supabaseAdmin
        .from('build_sessions')
        .update(updateData)
        .eq('id', sessionId);

      console.log('[vibesdk-chat] Build session updated');
    }

    // ---- Build SSE response for frontend compatibility ----
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (type: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
          } catch { /* stream closed */ }
        };

        // Émettre les événements dans le format attendu par useGenerateSite
        send('start', { sessionId, agentId: vibeAgentId });

        send('generation_event', {
          type: 'analyze',
          message: 'Analyse de votre demande...',
          status: 'completed',
        });

        send('generation_event', {
          type: 'thought',
          message: 'Génération du code via VibeSDK...',
          status: 'in-progress',
        });

        // Émettre les phases si disponibles
        if (vibeData.phases && Array.isArray(vibeData.phases)) {
          for (const phase of vibeData.phases) {
            send('generation_event', {
              type: 'phase',
              phase: phase.name || phase.id,
              status: phase.status || 'completed',
              message: `Phase: ${phase.name || phase.id}`,
            });
          }
        }

        // Émettre les fichiers
        if (Object.keys(filesRecord).length > 0) {
          for (const filePath of Object.keys(filesRecord)) {
            send('generation_event', {
              type: 'create',
              file: filePath,
              message: `Fichier créé: ${filePath}`,
              status: 'completed',
            });
          }

          send('files', { files: filesRecord, phase: 'complete' });
        }

        // Preview URL
        if (previewUrl) {
          send('preview', { url: previewUrl });
        }

        // Nom du projet
        if (vibeData.name || vibeData.title) {
          send('project_name', { name: vibeData.name || vibeData.title });
        }

        // Crédits restants
        const creditResult = newCredits?.[0];
        send('credits', {
          messages_used: creditResult?.messages_used || 0,
          messages_limit: creditResult?.messages_limit || 5,
          plan: creditResult?.plan || 'free',
          can_send: creditResult?.can_send ?? true,
        });

        // Complétion
        send('complete', {
          success: true,
          files: filesRecord,
          agentId: vibeAgentId,
          previewUrl,
          fileCount: Object.keys(filesRecord).length,
          tokens: { input: 0, output: 0, total: 0 },
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[vibesdk-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
