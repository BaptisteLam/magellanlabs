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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { modification, filePath, fileContent, sessionId } = await req.json();

    if (!modification || !filePath || !fileContent) {
      return new Response(
        JSON.stringify({ error: 'modification, filePath and fileContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[modify-site] User ${user.id} modifying ${filePath} for session ${sessionId}`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Prompt optimisé pour modification incrémentale (minimal context)
    const systemPrompt = `Tu es un expert développeur. Tu modifies UNIQUEMENT la partie demandée du code.

RÈGLES CRITIQUES :
1. Retourne UNIQUEMENT le code modifié du fichier ${filePath}
2. Ne retourne PAS tout le projet, juste ce fichier
3. Applique EXACTEMENT la modification demandée
4. Garde le même style de code et conventions
5. Pas de commentaires "TODO" ou placeholders
6. Code prêt à l'emploi immédiatement

FORMAT DE SORTIE :
Retourne directement le contenu complet du fichier modifié, sans balises markdown ni commentaires explicatifs.`;

    // Appel Anthropic API avec streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        stream: true,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Fichier actuel : ${filePath}

\`\`\`
${fileContent}
\`\`\`

Modification demandée : ${modification}

Retourne le fichier complet modifié.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[modify-site] Anthropic API error:', response.status, errorText);
      
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        429: 'Too many requests. Please try again in a few moments.',
        500: 'An unexpected error occurred. Please try again later.'
      };
      
      return new Response(
        JSON.stringify({ error: statusMessages[response.status] || 'Request failed. Please try again later.' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          data: { filePath }
        })}\n\n`));

        const decoder = new TextDecoder();
        let accumulated = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':') || line === '') continue;
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              if (dataStr === '[DONE]') {
                console.log(`[modify-site] ✅ Modification complète (${accumulated.length} chars)`);
                
                // Sauvegarder dans Supabase (background task - ne bloque pas la réponse)
                if (sessionId) {
                  (async () => {
                    try {
                      const { data } = await supabaseClient
                        .from('build_sessions')
                        .select('project_files')
                        .eq('id', sessionId)
                        .single();
                      
                      if (data?.project_files) {
                        const updatedFiles = data.project_files.map((f: any) =>
                          f.path === filePath ? { ...f, content: accumulated } : f
                        );
                        await supabaseClient
                          .from('build_sessions')
                          .update({ project_files: updatedFiles })
                          .eq('id', sessionId);
                      }
                    } catch (err) {
                      console.error('[modify-site] Background save error:', err);
                    }
                  })();
                }
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: { filePath, content: accumulated }
                })}\n\n`));
                
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.delta?.text || '';
                if (!delta) continue;

                accumulated += delta;
                
                // Stream du contenu modifié
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'delta',
                  data: { content: delta }
                })}\n\n`));
              } catch (e) {
                console.error('[modify-site] Parse error:', e);
              }
            }
          }
        } catch (error) {
          console.error('[modify-site] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Erreur inconnue' }
          })}\n\n`));
          controller.error(error);
        }
      }
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
    console.error('[modify-site] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Request failed. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
