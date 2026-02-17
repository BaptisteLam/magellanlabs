import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---- Token cache (in-memory, resets on cold start) ----
let cachedToken: { jwt: string; expiresAt: number } | null = null;

async function getVibeSDKToken(apiKey: string, baseUrl: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.jwt;
  }

  console.log('[vibesdk-chat] Exchanging API key for JWT...');
  const res = await fetch(`${baseUrl}/api/auth/exchange-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const jwt = data.data?.accessToken || data.accessToken || data.token;
  if (!jwt) throw new Error('No token in exchange response');

  cachedToken = { jwt, expiresAt: Date.now() + 15 * 60 * 1000 };
  console.log('[vibesdk-chat] JWT obtained');
  return jwt;
}

async function getWsTicket(agentId: string, token: string, baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/ws-ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ resourceType: 'agent', resourceId: agentId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WS ticket failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data?.ticket || data.ticket;
}

/**
 * vibesdk-chat Edge Function (lightweight)
 *
 * Creates a VibeSDK agent and returns a WebSocket ticket.
 * The frontend connects to the WebSocket directly to receive files.
 *
 * Flow:
 * 1. Exchange API key → JWT
 * 2. POST /api/agent (NDJSON) → agentId
 * 3. POST /api/ws-ticket → ticket (15s TTL, single-use)
 * 4. Return SSE: start → ws_connect → complete
 *
 * The frontend then:
 * 1. Connects to wss://build.cloudflare.dev/api/agent/{id}/ws?ticket=tk_xxx
 * 2. Sends { type: "generate_all" }
 * 3. Receives file_generated events
 * 4. Waits for generation_complete
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

    // ---- VibeSDK Configuration ----
    const VIBESDK_API_KEY = Deno.env.get('VIBESDK_API_KEY');
    if (!VIBESDK_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'VIBESDK_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const VIBESDK_BASE_URL = Deno.env.get('VIBESDK_BASE_URL') || 'https://build.cloudflare.dev';

    console.log(`[vibesdk-chat] User ${user.id} | Session ${sessionId} | Follow-up: ${!!isFollowUp} | Prompt: ${prompt.substring(0, 100)}...`);

    // ---- Exchange API key for JWT ----
    let vibeToken: string;
    try {
      vibeToken = await getVibeSDKToken(VIBESDK_API_KEY, VIBESDK_BASE_URL);
    } catch (tokenError) {
      console.error('[vibesdk-chat] Token exchange failed:', tokenError);
      return new Response(
        JSON.stringify({
          error: 'VibeSDK authentication failed',
          details: tokenError instanceof Error ? tokenError.message : 'Token exchange failed',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Create agent or send follow-up ----
    let vibeAgentId = agentId;
    let projectName: string | undefined;
    let wsUrl: string;

    if (isFollowUp && agentId) {
      // ===== FOLLOW-UP: Send message to existing agent =====
      console.log(`[vibesdk-chat] Follow-up to agent ${agentId}`);

      const msgResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent/${agentId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vibeToken}`,
        },
        body: JSON.stringify({ message: prompt, type: 'user_suggestion' }),
      });

      if (!msgResponse.ok) {
        const errText = await msgResponse.text();
        console.error(`[vibesdk-chat] Follow-up failed: ${msgResponse.status}`);

        if (msgResponse.status === 401 || msgResponse.status === 403) {
          cachedToken = null;
          vibeToken = await getVibeSDKToken(VIBESDK_API_KEY, VIBESDK_BASE_URL);
          const retry = await fetch(`${VIBESDK_BASE_URL}/api/agent/${agentId}/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${vibeToken}`,
            },
            body: JSON.stringify({ message: prompt, type: 'user_suggestion' }),
          });
          if (!retry.ok) {
            return new Response(
              JSON.stringify({ error: `Follow-up failed: ${retry.status}` }),
              { status: retry.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: `Follow-up failed: ${msgResponse.status}`, details: errText }),
            { status: msgResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      wsUrl = `wss://${new URL(VIBESDK_BASE_URL).host}/api/agent/${agentId}/ws`;

    } else {
      // ===== NEW BUILD: Create agent =====
      console.log('[vibesdk-chat] Creating new agent');

      const agentResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vibeToken}`,
        },
        body: JSON.stringify({
          query: prompt,
          projectType: 'app',
          behaviorType: 'phasic',
        }),
      });

      if (!agentResponse.ok) {
        const errText = await agentResponse.text();
        console.error(`[vibesdk-chat] Agent creation failed: ${agentResponse.status}`);

        if (agentResponse.status === 401 || agentResponse.status === 403) {
          cachedToken = null;
        }

        return new Response(
          JSON.stringify({ error: `Agent creation failed: ${agentResponse.status}`, details: errText }),
          { status: agentResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse NDJSON: first line has agentId + websocketUrl
      const text = await agentResponse.text();
      const firstLine = text.split('\n')[0];
      const initData = JSON.parse(firstLine);

      vibeAgentId = initData.agentId || initData.id;
      wsUrl = initData.websocketUrl || `wss://${new URL(VIBESDK_BASE_URL).host}/api/agent/${vibeAgentId}/ws`;

      // Extract project name from plan chunks
      const lines = text.trim().split('\n');
      let planText = '';
      for (let i = 1; i < lines.length; i++) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj.chunk) planText += obj.chunk;
        } catch { /* skip */ }
      }
      try {
        const plan = JSON.parse(planText);
        projectName = plan.title || plan.projectName;
      } catch { /* plan not fully parsed */ }

      console.log(`[vibesdk-chat] Agent created: ${vibeAgentId}`);
    }

    // ---- Get WebSocket ticket ----
    let wsTicket: string;
    try {
      wsTicket = await getWsTicket(vibeAgentId, vibeToken, VIBESDK_BASE_URL);
      console.log(`[vibesdk-chat] WS ticket obtained: ${wsTicket.substring(0, 10)}...`);
    } catch (ticketError) {
      console.error('[vibesdk-chat] WS ticket failed:', ticketError);
      return new Response(
        JSON.stringify({
          error: 'Failed to get WebSocket ticket',
          details: ticketError instanceof Error ? ticketError.message : 'Unknown',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Increment credits ----
    const { data: newCredits } = await supabaseAdmin
      .rpc('increment_messages_used', { p_user_id: user.id });

    // ---- Save generation to DB ----
    await supabaseAdmin.from('generations').insert({
      user_id: user.id,
      session_id: sessionId || null,
      vibesdk_session_id: vibeAgentId,
      prompt,
      code: '{}',
      status: 'pending',
      tokens_used: 0,
      created_at: new Date().toISOString(),
    });

    // ---- Update build session with agentId ----
    if (sessionId) {
      const updateData: Record<string, unknown> = {
        vibesdk_session_id: vibeAgentId,
        updated_at: new Date().toISOString(),
      };
      if (projectName) {
        updateData.title = projectName;
      }
      await supabaseAdmin
        .from('build_sessions')
        .update(updateData)
        .eq('id', sessionId);
    }

    // ---- Build SSE response ----
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (type: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
          } catch { /* stream closed */ }
        };

        send('start', { sessionId, agentId: vibeAgentId });

        send('generation_event', {
          type: 'analyze',
          message: 'Analyse de votre demande...',
          status: 'completed',
        });

        send('generation_event', {
          type: 'thought',
          message: 'Connexion à VibeSDK...',
          status: 'in-progress',
        });

        // Key event: tell the frontend to connect to WebSocket
        send('ws_connect', {
          wsUrl,
          ticket: wsTicket,
          agentId: vibeAgentId,
          isFollowUp: !!(isFollowUp && agentId),
        });

        if (projectName) {
          send('project_name', { name: projectName });
        }

        const creditResult = newCredits?.[0];
        send('credits', {
          messages_used: creditResult?.messages_used || 0,
          messages_limit: creditResult?.messages_limit || 5,
          plan: creditResult?.plan || 'free',
          can_send: creditResult?.can_send ?? true,
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
