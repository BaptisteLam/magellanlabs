import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

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

    if (!message || !relevantFiles || !Array.isArray(relevantFiles)) {
      return new Response(
        JSON.stringify({ error: 'message and relevantFiles required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[modify-site] ${relevantFiles.length} files, ${message.length} chars`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // CONTEXTE MINIMAL: extraire seulement les zones pertinentes
    const minimalContext = relevantFiles
      .map((f: any) => {
        const lines = f.content.split('\n');
        // Si fichier > 100 lignes, prendre début + fin seulement
        if (lines.length > 100) {
          const preview = [
            ...lines.slice(0, 20),
            `... (${lines.length - 40} lines omitted) ...`,
            ...lines.slice(-20)
          ].join('\n');
          return `${f.path}:\n${preview}`;
        }
        return `${f.path}:\n${f.content}`;
      })
      .join('\n\n---\n\n');

    // PROMPT OPTIMISÉ POUR DIFFS
    const systemPrompt = `You are a code diff expert. Generate ONLY unified diffs, never full files.

CRITICAL RULES:
1. Return ONLY the minimal changes needed
2. Use unified diff format:
   FILE: path/to/file.tsx
   DIFF:
   @@ -10,3 +10,4 @@
    unchanged line
   -old line
   +new line
    unchanged line
   END_DIFF

3. Include 2-3 lines of context before/after changes
4. NEVER regenerate entire files
5. Be surgical: change only what's requested`;

    // Streaming optimisé
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000, // Réduit de 16k à 4k (diffs sont plus courts)
        temperature: 0.3, // Plus déterministe
        stream: true,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Files (minimal context):\n${minimalContext}\n\nTask: ${message}\n\nReturn unified diffs ONLY.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[modify-site] API error:', response.status, errorText);
      
      const statusMessages: Record<number, string> = {
        400: 'Invalid request',
        401: 'Auth failed',
        429: 'Rate limited - try again in a moment',
        500: 'API error'
      };
      
      return new Response(
        JSON.stringify({ error: statusMessages[response.status] || 'Failed' }),
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

        const decoder = new TextDecoder();
        let fullResponse = '';
        
        try {
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

          // Parser les diffs
          const diffRegex = /FILE:\s*(.+?)\s*DIFF:\s*([\s\S]+?)(?=FILE:|END_DIFF|$)/g;
          const diffs: Array<{path: string, diff: string}> = [];
          let match;

          while ((match = diffRegex.exec(fullResponse)) !== null) {
            const filePath = match[1].trim();
            let diff = match[2].trim();
            
            // Nettoyer markdown
            diff = diff.replace(/^```diff\n?/, '').replace(/\n?```$/, '').trim();
            
            diffs.push({ path: filePath, diff });
          }

          console.log(`[modify-site] ✅ ${diffs.length} diffs generated`);
          console.log(`[modify-site] 📊 Tokens saved: ~${Math.round((1 - fullResponse.length / (minimalContext.length * 2)) * 100)}%`);

          // Sauvegarder en arrière-plan (sans await)
          if (sessionId && diffs.length > 0) {
            (async () => {
              try {
                const { data } = await supabaseClient
                  .from('build_sessions')
                  .select('project_files')
                  .eq('id', sessionId)
                  .single();
                
                if (data?.project_files) {
                  const updatedFiles = data.project_files.map((f: any) => {
                    const fileDiff = diffs.find(d => d.path === f.path);
                    if (!fileDiff) return f;
                    
                    // Appliquer le diff (simplifié - le client fera le vrai apply)
                    return { ...f, needsUpdate: true, diff: fileDiff.diff };
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

          // Envoyer les diffs
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: { diffs }
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          console.error('[modify-site] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Error' }
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
      JSON.stringify({ error: 'Failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
