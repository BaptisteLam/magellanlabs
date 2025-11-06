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

    // PROMPT OPTIMISÉ : réponse conversationnelle + diffs
    const systemPrompt = `Tu es un assistant de modification de code. Réponds en deux parties:

1. **Réponse courte** (1 phrase): Dis ce que tu vas faire
2. **Actions XML**: Modifications précises

FORMAT:
Je vais modifier X.

<file path="src/App.tsx">
<action type="replace" search="texte exact à trouver" content="nouveau texte" />
</file>

TYPES:
- replace: remplace du texte exact
- insert-after: insère après une ligne
- insert-before: insère avant une ligne

RÈGLES:
- search DOIT être EXACT (copie du code)
- Inclure indentation dans search
- Plusieurs actions possibles par fichier`;

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
        let conversationalResponse = '';
        let inXmlSection = false;
        
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
                
                // Détecter XML
                if (delta.includes('<file') || inXmlSection) {
                  inXmlSection = true;
                }
                
                // Stream conversationnel
                if (!inXmlSection) {
                  conversationalResponse += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'message',
                    content: delta
                  })}\n\n`));
                }
              } catch (e) {
                console.error('[modify-site] Parse error:', e);
              }
            }
          }

          // Parser les actions XML
          const actions: Array<{path: string, type: string, search?: string, content?: string}> = [];
          const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
          let fileMatch;
          
          while ((fileMatch = fileRegex.exec(fullResponse)) !== null) {
            const path = fileMatch[1];
            const fileContent = fileMatch[2];
            
            const actionRegex = /<action type="([^"]+)"(?:\s+search="([^"]*)")?(?:\s+content="([^"]*)")?\s*\/>/g;
            let actionMatch;
            
            while ((actionMatch = actionRegex.exec(fileContent)) !== null) {
              actions.push({
                path,
                type: actionMatch[1],
                search: actionMatch[2]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') || '',
                content: actionMatch[3]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') || ''
              });
            }
          }

          console.log(`[modify-site] ✅ ${actions.length} actions generated`);

          // Envoyer les actions + message conversationnel
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: { 
              actions,
              message: conversationalResponse.trim()
            }
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
