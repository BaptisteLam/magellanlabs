import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const V0_API_BASE = 'https://api.v0.dev';

/**
 * v0-chat Edge Function
 *
 * Crée un chat v0 avec le prompt utilisateur ou envoie un message de suivi.
 * Gère le streaming SSE, le suivi des crédits, et la persistence en DB.
 *
 * POST /v0-chat
 * Body: { prompt, sessionId, chatId?, projectId?, isFollowUp? }
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
    const { prompt, sessionId, chatId, projectId, isFollowUp } = await req.json();

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
      console.error('[v0-chat] Error checking credits:', creditsError);
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

    // ---- v0 API Key ----
    const V0_API_KEY = Deno.env.get('V0_API_KEY');
    if (!V0_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'V0_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[v0-chat] User ${user.id} | Session ${sessionId} | Follow-up: ${!!isFollowUp} | Prompt: ${prompt.substring(0, 100)}...`);

    // ---- Call v0 API ----
    let v0Response: Response;

    if (isFollowUp && chatId) {
      // Envoyer un message de suivi à un chat existant
      v0Response = await fetch(`${V0_API_BASE}/v1/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${V0_API_KEY}`,
        },
        body: JSON.stringify({
          message: prompt,
          responseMode: 'sync',
        }),
      });
    } else {
      // Créer un nouveau chat
      v0Response = await fetch(`${V0_API_BASE}/v1/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${V0_API_KEY}`,
        },
        body: JSON.stringify({
          message: prompt,
          system: 'Tu génères des sites web professionnels, modernes et responsive. Utilise HTML, CSS et JavaScript vanilla. Crée un design unique et attractif.',
          chatPrivacy: 'private',
          responseMode: 'sync',
          ...(projectId ? { projectId } : {}),
          modelConfiguration: {
            imageGenerations: false,
            thinking: true,
          },
        }),
      });
    }

    if (!v0Response.ok) {
      const errorText = await v0Response.text();
      console.error('[v0-chat] v0 API error:', v0Response.status, errorText);
      return new Response(
        JSON.stringify({ error: `v0 API error: ${v0Response.status}`, details: errorText }),
        { status: v0Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const v0Data = await v0Response.json();
    console.log('[v0-chat] v0 response received:', {
      chatId: v0Data.id,
      hasLatestVersion: !!v0Data.latestVersion,
      filesCount: v0Data.latestVersion?.files?.length || 0,
      demoUrl: v0Data.latestVersion?.demoUrl,
      status: v0Data.latestVersion?.status,
    });

    // ---- Extract files from v0 response ----
    const v0Files = v0Data.latestVersion?.files || [];
    const filesRecord: Record<string, string> = {};
    for (const file of v0Files) {
      const path = file.name.startsWith('/') ? file.name : `/${file.name}`;
      filesRecord[path] = file.content;
    }

    const demoUrl = v0Data.latestVersion?.demoUrl || null;
    const v0ChatId = v0Data.id;

    // ---- Increment credits ----
    const { data: newCredits } = await supabaseAdmin
      .rpc('increment_messages_used', { p_user_id: user.id });

    // ---- Save generation to DB ----
    await supabaseAdmin.from('generations').insert({
      user_id: user.id,
      session_id: sessionId || null,
      v0_chat_id: v0ChatId,
      v0_project_id: v0Data.projectId || null,
      prompt,
      code: JSON.stringify(filesRecord),
      preview_url: demoUrl,
      demo_url: demoUrl,
      status: 'completed',
      tokens_used: 0, // v0 API doesn't expose token counts directly
      created_at: new Date().toISOString(),
    });

    // ---- Update build session ----
    if (sessionId && Object.keys(filesRecord).length > 0) {
      const updateData: Record<string, unknown> = {
        project_files: filesRecord,
        v0_chat_id: v0ChatId,
        updated_at: new Date().toISOString(),
      };

      if (v0Data.projectId) {
        updateData.v0_project_id = v0Data.projectId;
      }

      // Utiliser le nom du chat v0 comme titre si pas déjà défini
      if (v0Data.name) {
        const { data: currentSession } = await supabaseAdmin
          .from('build_sessions')
          .select('title')
          .eq('id', sessionId)
          .maybeSingle();

        if (!currentSession?.title || currentSession.title === sessionId) {
          updateData.title = v0Data.name;
        }
      }

      await supabaseAdmin
        .from('build_sessions')
        .update(updateData)
        .eq('id', sessionId);

      console.log('[v0-chat] Build session updated');
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
        send('start', { sessionId, chatId: v0ChatId });

        send('generation_event', {
          type: 'analyze',
          message: 'Analyse de votre demande...',
          status: 'completed',
        });

        send('generation_event', {
          type: 'thought',
          message: 'Génération du code en cours...',
          status: 'in-progress',
        });

        // Émettre les fichiers
        if (Object.keys(filesRecord).length > 0) {
          // Émettre un événement par fichier
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
        if (demoUrl) {
          send('preview', { url: demoUrl });
        }

        // Nom du projet
        if (v0Data.name) {
          send('project_name', { name: v0Data.name });
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
          chatId: v0ChatId,
          demoUrl,
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
    console.error('[v0-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
