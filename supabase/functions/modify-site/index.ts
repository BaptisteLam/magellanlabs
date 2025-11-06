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

    const { message, relevantFiles, sessionId } = await req.json();

    if (!message || !relevantFiles || !Array.isArray(relevantFiles) || relevantFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'message and relevantFiles are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[modify-site] Session ${sessionId} - ${relevantFiles.length} fichiers`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Construire le contexte avec tous les fichiers
    const filesContext = relevantFiles
      .map((f: any) => `=== ${f.path} ===\n${f.content}`)
      .join('\n\n');

    const systemPrompt = `Tu es un expert développeur React/TypeScript. Tu modifies le code selon les demandes de l'utilisateur.

RÈGLES :
1. Applique EXACTEMENT la modification demandée
2. Retourne UNIQUEMENT les fichiers modifiés
3. Format de sortie : Pour chaque fichier modifié, écris:
   FILE: chemin/du/fichier.tsx
   CONTENT:
   [contenu complet du fichier]
   END_FILE

4. Ne modifie que ce qui est demandé
5. Code production-ready sans TODO`;

    // Streaming de Claude Sonnet
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        stream: true,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Fichiers du projet:

${filesContext}

Modification demandée: ${message}

Retourne les fichiers modifiés au format spécifié.`
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

    // Stream SSE avec parsing des fichiers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let fullResponse = '';
        
        try {
          // Lecture du stream Claude
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              if (dataStr === '[DONE]') continue;

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.delta?.text || '';
                if (!delta) continue;

                fullResponse += delta;
                
                // Stream chaque token
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'delta',
                  data: { content: delta }
                })}\n\n`));
              } catch (e) {
                console.error('[modify-site] Parse error:', e);
              }
            }
          }

          // Parser les fichiers de la réponse complète
          const fileRegex = /FILE:\s*(.+?)\s*CONTENT:\s*([\s\S]+?)(?=FILE:|END_FILE|$)/g;
          const modifiedFiles: Array<{path: string, content: string}> = [];
          let match;

          while ((match = fileRegex.exec(fullResponse)) !== null) {
            const filePath = match[1].trim();
            let content = match[2].trim();
            
            // Nettoyer les balises markdown si présentes
            content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
            
            modifiedFiles.push({ path: filePath, content });
          }

          console.log(`[modify-site] ✅ ${modifiedFiles.length} fichiers modifiés`);

          // Sauvegarder en arrière-plan
          if (sessionId && modifiedFiles.length > 0) {
            (async () => {
              try {
                const { data } = await supabaseClient
                  .from('build_sessions')
                  .select('project_files')
                  .eq('id', sessionId)
                  .single();
                
                if (data?.project_files) {
                  const updatedFiles = data.project_files.map((f: any) => {
                    const modified = modifiedFiles.find(mf => mf.path === f.path);
                    return modified ? { ...f, content: modified.content } : f;
                  });
                  
                  await supabaseClient
                    .from('build_sessions')
                    .update({ project_files: updatedFiles })
                    .eq('id', sessionId);
                }
              } catch (err) {
                console.error('[modify-site] Save error:', err);
              }
            })();
          }

          // Envoyer la fin avec les fichiers
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: { files: modifiedFiles }
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          console.error('[modify-site] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Erreur' }
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
