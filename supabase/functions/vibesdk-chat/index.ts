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

/**
 * Get a one-time WebSocket ticket for the given agent.
 */
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
 * Parse NDJSON response from POST /api/agent.
 * First line = agent metadata + template. Subsequent lines = plan chunks.
 */
async function parseNDJSON(response: Response): Promise<{
  agentId: string;
  websocketUrl: string;
  template: { name: string; files: Array<{ filePath: string; fileContents: string }> };
  planChunks: string;
  projectName?: string;
}> {
  const text = await response.text();
  const lines = text.trim().split('\n').filter(Boolean);

  if (lines.length === 0) throw new Error('Empty NDJSON response');

  const firstLine = JSON.parse(lines[0]);
  const agentId = firstLine.agentId || firstLine.id;
  const websocketUrl = firstLine.websocketUrl || '';
  const template = firstLine.template || { name: '', files: [] };

  // Concatenate chunk lines to extract plan metadata
  let planChunks = '';
  for (let i = 1; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.chunk) planChunks += obj.chunk;
    } catch { /* skip malformed lines */ }
  }

  // Try to extract project name from the plan
  let projectName: string | undefined;
  try {
    const planObj = JSON.parse(planChunks);
    projectName = planObj.title || planObj.projectName;
  } catch { /* plan may not be valid JSON yet */ }

  return { agentId, websocketUrl, template, planChunks, projectName };
}

/**
 * Connect to VibeSDK WebSocket and collect generated files.
 * Returns a map of filePath -> fileContents.
 *
 * Protocol:
 * - Send { type: "generate_all" } to trigger generation
 * - Listen for file_generated / file_regenerated events
 * - Wait for generation_complete event
 */
function collectFilesViaWebSocket(
  wsUrl: string,
  ticket: string,
  timeoutMs = 120_000,
): Promise<{
  files: Record<string, string>;
  previewUrl?: string;
  projectName?: string;
}> {
  return new Promise((resolve, reject) => {
    const files: Record<string, string> = {};
    let previewUrl: string | undefined;
    let projectName: string | undefined;
    let resolved = false;

    const wsUrlWithTicket = `${wsUrl}?ticket=${ticket}`;
    console.log(`[vibesdk-chat] Connecting to WebSocket: ${wsUrl.substring(0, 60)}...`);

    const ws = new WebSocket(wsUrlWithTicket);

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`[vibesdk-chat] WebSocket timeout after ${timeoutMs}ms, returning ${Object.keys(files).length} files collected so far`);
        try { ws.close(); } catch { /* ignore */ }
        resolve({ files, previewUrl, projectName });
      }
    }, timeoutMs);

    ws.onopen = () => {
      console.log('[vibesdk-chat] WebSocket connected, sending generate_all');
      ws.send(JSON.stringify({ type: 'generate_all' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');

        switch (msg.type) {
          case 'agent_connected': {
            // Full state with existing files
            const state = msg.state || msg;
            if (state.generatedFilesMap && typeof state.generatedFilesMap === 'object') {
              for (const [path, fileObj] of Object.entries(state.generatedFilesMap)) {
                const content = typeof fileObj === 'string'
                  ? fileObj
                  : (fileObj as any)?.fileContents || '';
                if (content) files[path] = content;
              }
              console.log(`[vibesdk-chat] agent_connected: ${Object.keys(state.generatedFilesMap).length} existing files`);
            }
            if (state.previewUrl) previewUrl = state.previewUrl;
            break;
          }

          case 'generation_started':
            console.log(`[vibesdk-chat] Generation started: ${msg.message || ''} (${msg.totalFiles || '?'} files)`);
            break;

          case 'file_generating':
            console.log(`[vibesdk-chat] Generating: ${msg.filePath}`);
            break;

          case 'file_generated':
          case 'file_regenerated': {
            const file = msg.file;
            if (file?.filePath && file?.fileContents) {
              files[file.filePath] = file.fileContents;
              console.log(`[vibesdk-chat] File ready: ${file.filePath} (${file.fileContents.length} chars)`);
            }
            break;
          }

          case 'project_name_updated':
            if (msg.projectName) projectName = msg.projectName;
            break;

          case 'generation_complete': {
            console.log(`[vibesdk-chat] Generation complete! ${Object.keys(files).length} files, previewURL: ${msg.previewURL || 'N/A'}`);
            if (msg.previewURL) previewUrl = msg.previewURL;
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try { ws.close(); } catch { /* ignore */ }
              resolve({ files, previewUrl, projectName });
            }
            break;
          }

          case 'deployment_completed':
            if (msg.previewURL) previewUrl = msg.previewURL;
            break;

          case 'error':
          case 'rate_limit_error':
            console.error(`[vibesdk-chat] WebSocket error: ${msg.error || JSON.stringify(msg)}`);
            break;

          case 'phase_generating':
          case 'phase_generated':
          case 'phase_implementing':
          case 'phase_implemented':
          case 'phase_validating':
          case 'phase_validated':
            console.log(`[vibesdk-chat] Phase: ${msg.type} - ${msg.message || ''}`);
            break;

          default:
            // Ignore other event types (conversation, deployment, etc.)
            break;
        }
      } catch (e) {
        console.warn('[vibesdk-chat] Failed to parse WS message:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('[vibesdk-chat] WebSocket error:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        // Return whatever we have
        resolve({ files, previewUrl, projectName });
      }
    };

    ws.onclose = () => {
      console.log(`[vibesdk-chat] WebSocket closed, ${Object.keys(files).length} files collected`);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ files, previewUrl, projectName });
      }
    };
  });
}

// ============= Main Handler =============

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

    // ---- Call VibeSDK API ----
    let vibeAgentId = agentId;
    let filesRecord: Record<string, string> = {};
    let previewUrl: string | null = null;
    let projectName: string | undefined;

    if (isFollowUp && agentId) {
      // ===== FOLLOW-UP: Send message + reconnect to WebSocket for new files =====
      console.log(`[vibesdk-chat] Follow-up to agent ${agentId}`);

      // Send the message
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
        console.error(`[vibesdk-chat] Follow-up failed: ${msgResponse.status} ${errText}`);

        // If 401/403, retry with fresh token
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

      // Connect to WebSocket to receive updated files
      try {
        const ticket = await getWsTicket(agentId, vibeToken, VIBESDK_BASE_URL);
        const wsUrl = `wss://${new URL(VIBESDK_BASE_URL).host}/api/agent/${agentId}/ws`;
        const result = await collectFilesViaWebSocket(wsUrl, ticket, 90_000);
        filesRecord = result.files;
        previewUrl = result.previewUrl || null;
        projectName = result.projectName;
      } catch (wsError) {
        console.warn('[vibesdk-chat] WebSocket follow-up failed:', wsError);
      }

    } else {
      // ===== NEW BUILD: Create agent + connect to WebSocket =====
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
        console.error(`[vibesdk-chat] Agent creation failed: ${agentResponse.status} ${errText}`);

        if (agentResponse.status === 401 || agentResponse.status === 403) {
          cachedToken = null;
          return new Response(
            JSON.stringify({ error: 'VibeSDK auth failed, token expired' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ error: `Agent creation failed: ${agentResponse.status}`, details: errText }),
          { status: agentResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse NDJSON response
      const ndjson = await parseNDJSON(agentResponse);
      vibeAgentId = ndjson.agentId;
      projectName = ndjson.projectName;

      console.log(`[vibesdk-chat] Agent created: ${vibeAgentId}, template: ${ndjson.template.files.length} files`);

      // Connect to WebSocket to receive generated files
      try {
        const ticket = await getWsTicket(vibeAgentId, vibeToken, VIBESDK_BASE_URL);
        const wsUrl = ndjson.websocketUrl || `wss://${new URL(VIBESDK_BASE_URL).host}/api/agent/${vibeAgentId}/ws`;
        const result = await collectFilesViaWebSocket(wsUrl, ticket, 120_000);
        filesRecord = result.files;
        previewUrl = result.previewUrl || null;
        projectName = result.projectName || projectName;
      } catch (wsError) {
        console.warn('[vibesdk-chat] WebSocket collection failed:', wsError);

        // Fallback: use template files if WebSocket failed
        if (ndjson.template.files.length > 0 && Object.keys(filesRecord).length === 0) {
          console.log('[vibesdk-chat] Falling back to template files');
          for (const file of ndjson.template.files) {
            if (file.filePath && file.fileContents) {
              filesRecord[file.filePath] = file.fileContents;
            }
          }
        }
      }
    }

    // Normalize file paths (ensure they start with /)
    const normalizedFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(filesRecord)) {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      normalizedFiles[normalizedPath] = content;
    }
    filesRecord = normalizedFiles;

    console.log(`[vibesdk-chat] Final: ${Object.keys(filesRecord).length} files, preview: ${previewUrl}`);

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
      status: Object.keys(filesRecord).length > 0 ? 'completed' : 'pending',
      tokens_used: 0,
      created_at: new Date().toISOString(),
    });

    // ---- Update build session ----
    if (sessionId) {
      const updateData: Record<string, unknown> = {
        vibesdk_session_id: vibeAgentId,
        updated_at: new Date().toISOString(),
      };

      if (Object.keys(filesRecord).length > 0) {
        updateData.project_files = filesRecord;
      }

      if (projectName) {
        const { data: currentSession } = await supabaseAdmin
          .from('build_sessions')
          .select('title')
          .eq('id', sessionId)
          .maybeSingle();

        if (!currentSession?.title || currentSession.title === sessionId) {
          updateData.title = projectName;
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

        send('start', { sessionId, agentId: vibeAgentId });

        send('generation_event', {
          type: 'analyze',
          message: 'Analyse de votre demande...',
          status: 'completed',
        });

        send('generation_event', {
          type: 'thought',
          message: 'Génération du code via VibeSDK...',
          status: Object.keys(filesRecord).length > 0 ? 'completed' : 'in-progress',
        });

        // Emit file creation events
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

        if (previewUrl) {
          send('preview', { url: previewUrl });
        }

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

        send('complete', {
          success: Object.keys(filesRecord).length > 0,
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
