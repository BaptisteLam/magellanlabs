import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * vibesdk-chat Edge Function
 *
 * Creates a VibeSDK session or sends a follow-up message.
 * Handles JWT token exchange, polling for files, SSE streaming,
 * credit tracking, and DB persistence.
 *
 * POST /vibesdk-chat
 * Body: { prompt, sessionId, agentId?, isFollowUp? }
 */

// ---- Token cache (in-memory, resets on cold start) ----
let cachedToken: { jwt: string; expiresAt: number } | null = null;

/**
 * Exchange the API key for a short-lived JWT.
 * Caches the token and refreshes 60s before expiry.
 */
async function getVibeSDKToken(apiKey: string, baseUrl: string): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.jwt;
  }

  console.log('[vibesdk-chat] Exchanging API key for JWT...');

  const exchangeResponse = await fetch(`${baseUrl}/api/auth/exchange-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!exchangeResponse.ok) {
    const errorText = await exchangeResponse.text();
    console.error('[vibesdk-chat] Token exchange failed:', exchangeResponse.status, errorText);
    throw new Error(`VibeSDK token exchange failed (${exchangeResponse.status}): ${errorText}`);
  }

  const data = await exchangeResponse.json();
  const jwt = data.accessToken || data.token || data.jwt;

  if (!jwt) {
    throw new Error('VibeSDK token exchange returned no token');
  }

  // Cache for 15 minutes (default JWT lifetime)
  cachedToken = {
    jwt,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  console.log('[vibesdk-chat] JWT obtained successfully');
  return jwt;
}

/**
 * Extract files from a VibeSDK response (handles multiple formats).
 */
function extractFiles(data: any): Record<string, string> {
  const files: Record<string, string> = {};

  if (!data?.files) return files;

  if (Array.isArray(data.files)) {
    for (const file of data.files) {
      if (!file.content && !file.source) continue;
      const rawPath = file.path || file.name || '';
      const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
      files[path] = file.content || file.source || '';
    }
  } else if (typeof data.files === 'object') {
    for (const [key, value] of Object.entries(data.files)) {
      if (typeof value === 'string') {
        const path = key.startsWith('/') ? key : `/${key}`;
        files[path] = value;
      }
    }
  }

  return files;
}

/**
 * Poll the VibeSDK agent status until files are available or timeout.
 * Uses exponential backoff: 3s, 5s, 8s, 12s, 15s (up to ~60s total).
 */
async function pollForFiles(
  agentId: string,
  token: string,
  baseUrl: string,
  maxAttempts = 8,
): Promise<{ files: Record<string, string>; previewUrl?: string; status?: string }> {
  const delays = [3000, 5000, 8000, 10000, 12000, 15000, 15000, 15000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = delays[Math.min(attempt, delays.length - 1)];
    console.log(`[vibesdk-chat] Polling attempt ${attempt + 1}/${maxAttempts} (wait ${delay}ms)...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const statusResponse = await fetch(`${baseUrl}/api/agent/${agentId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!statusResponse.ok) {
        console.warn(`[vibesdk-chat] Status poll failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`[vibesdk-chat] Poll ${attempt + 1}: status=${statusData.status}, hasFiles=${!!statusData.files}`);

      const files = extractFiles(statusData);

      if (Object.keys(files).length > 0) {
        console.log(`[vibesdk-chat] Got ${Object.keys(files).length} files after ${attempt + 1} polls`);
        return {
          files,
          previewUrl: statusData.previewUrl,
          status: statusData.status,
        };
      }

      // If generation is complete but no files, stop polling
      if (statusData.status === 'complete' || statusData.status === 'error' || statusData.status === 'failed') {
        console.warn(`[vibesdk-chat] Agent status is '${statusData.status}' but no files found`);
        return { files: {}, status: statusData.status };
      }
    } catch (e) {
      console.warn(`[vibesdk-chat] Poll error (attempt ${attempt + 1}):`, e);
    }
  }

  console.warn('[vibesdk-chat] Polling exhausted without files');
  return { files: {} };
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
    let vibeResponse: Response;
    let vibeAgentId = agentId;

    if (isFollowUp && agentId) {
      // Send follow-up message to existing agent
      console.log(`[vibesdk-chat] Sending follow-up to agent ${agentId}`);
      vibeResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent/${agentId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vibeToken}`,
        },
        body: JSON.stringify({
          message: prompt,
          type: 'user_suggestion',
        }),
      });
    } else {
      // Create new agent/build
      console.log('[vibesdk-chat] Creating new agent');
      vibeResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent`, {
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
    }

    if (!vibeResponse.ok) {
      const errorText = await vibeResponse.text();
      console.error('[vibesdk-chat] VibeSDK API error:', vibeResponse.status, errorText);

      // If auth failed (token expired), invalidate cache and retry once
      if (vibeResponse.status === 401 || vibeResponse.status === 403) {
        cachedToken = null;
        console.log('[vibesdk-chat] Token might be expired, retrying exchange...');
        try {
          vibeToken = await getVibeSDKToken(VIBESDK_API_KEY, VIBESDK_BASE_URL);
          // Retry the original request
          const retryUrl = isFollowUp && agentId
            ? `${VIBESDK_BASE_URL}/api/agent/${agentId}/message`
            : `${VIBESDK_BASE_URL}/api/agent`;
          const retryBody = isFollowUp && agentId
            ? JSON.stringify({ message: prompt, type: 'user_suggestion' })
            : JSON.stringify({ query: prompt, projectType: 'app', behaviorType: 'phasic' });

          vibeResponse = await fetch(retryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${vibeToken}`,
            },
            body: retryBody,
          });

          if (!vibeResponse.ok) {
            const retryError = await vibeResponse.text();
            throw new Error(`Retry failed: ${vibeResponse.status} ${retryError}`);
          }
        } catch (retryError) {
          return new Response(
            JSON.stringify({ error: `VibeSDK API error after retry: ${vibeResponse.status}`, details: errorText }),
            { status: vibeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: `VibeSDK API error: ${vibeResponse.status}`, details: errorText }),
          { status: vibeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const vibeData = await vibeResponse.json();
    console.log('[vibesdk-chat] VibeSDK response:', {
      agentId: vibeData.agentId || vibeData.id,
      hasFiles: !!vibeData.files,
      previewUrl: vibeData.previewUrl,
      status: vibeData.status,
      keys: Object.keys(vibeData),
    });

    // ---- Extract agent ID ----
    vibeAgentId = vibeData.agentId || vibeData.id || agentId;

    // ---- Extract files (direct or via polling) ----
    let filesRecord = extractFiles(vibeData);
    let previewUrl = vibeData.previewUrl || null;

    // If no files in initial response, poll the agent status
    if (Object.keys(filesRecord).length === 0 && vibeAgentId) {
      console.log('[vibesdk-chat] No files in initial response, starting polling...');
      const pollResult = await pollForFiles(vibeAgentId, vibeToken, VIBESDK_BASE_URL);
      filesRecord = pollResult.files;
      previewUrl = pollResult.previewUrl || previewUrl;
    }

    console.log(`[vibesdk-chat] Final: ${Object.keys(filesRecord).length} files, previewUrl: ${previewUrl}`);

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

      // Use VibeSDK project name as title if available
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

        // Emit events in the format expected by useGenerateSite
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

        // Emit phases if available
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

        // Emit files
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

        // Project name
        if (vibeData.name || vibeData.title) {
          send('project_name', { name: vibeData.name || vibeData.title });
        }

        // Remaining credits
        const creditResult = newCredits?.[0];
        send('credits', {
          messages_used: creditResult?.messages_used || 0,
          messages_limit: creditResult?.messages_limit || 5,
          plan: creditResult?.plan || 'free',
          can_send: creditResult?.can_send ?? true,
        });

        // Completion
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
