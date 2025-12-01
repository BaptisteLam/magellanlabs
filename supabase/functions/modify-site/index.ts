import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache en mémoire pour patterns fréquents (réinitialise au redémarrage de la fonction)
const patternCache = new Map<string, {
  response: any;
  timestamp: number;
}>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

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

    const { message, relevantFiles, sessionId, complexity } = await req.json();

    if (!message || !relevantFiles || !Array.isArray(relevantFiles)) {
      return new Response(
        JSON.stringify({ error: 'message and relevantFiles required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[modify-site] ${relevantFiles.length} files, ${message.length} chars, complexity: ${complexity || 'unknown'}`);

    // Vérifier le cache pour patterns fréquents
    const cacheKey = `${message.toLowerCase().trim()}_${relevantFiles.length}`;
    const cached = patternCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('[modify-site] ⚡ Cache hit!');
      return new Response(
        JSON.stringify({ type: 'complete', data: cached.response }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // === CONTEXTE OPTIMISÉ ===
    // Pour modifications simples, extraire seulement les zones pertinentes
    const minimalContext = relevantFiles
      .map((f: any) => {
        const lines = f.content.split('\n');
        
    // Stratégie adaptative selon la complexité (limites augmentées pour meilleur contexte)
        const maxLines = complexity === 'trivial' ? 100 : complexity === 'simple' ? 150 : 250;
        
        if (lines.length > maxLines) {
          const headLines = Math.floor(maxLines * 0.4);
          const tailLines = Math.floor(maxLines * 0.4);
          
          const preview = [
            ...lines.slice(0, headLines),
            `... [${lines.length - headLines - tailLines} lignes omises pour optimisation] ...`,
            ...lines.slice(-tailLines)
          ].join('\n');
          return `${f.path}:\n${preview}`;
        }
        return `${f.path}:\n${f.content}`;
      })
      .join('\n\n---\n\n');

    // === SÉLECTION DU MODÈLE SELON COMPLEXITÉ ===
    let model = 'claude-sonnet-4-5'; // Modèle par défaut
    let maxTokens = 4000;
    let temperature = 0.3;
    
    if (complexity === 'trivial') {
      // Modifications ultra-simples: utiliser Haiku pour vitesse maximale
      model = 'claude-3-5-haiku-20241022';
      maxTokens = 2000;
      temperature = 0.2;
      console.log('[modify-site] Using claude-3-5-haiku for trivial modification');
    } else if (complexity === 'simple') {
      // Modifications simples: Sonnet avec tokens réduits
      maxTokens = 3000;
      console.log('[modify-site] Using claude-sonnet-4-5 (reduced tokens) for simple modification');
    } else {
      // Modifications complexes: Sonnet avec plus de tokens
      maxTokens = 5000;
      console.log('[modify-site] Using claude-sonnet-4-5 (full) for complex modification');
    }

    // === PROMPT OPTIMISÉ SELON COMPLEXITÉ (FORMAT JSON) ===
    const baseSystemPrompt = `Tu es un assistant de modification de code ultra-rapide et précis.

FORMAT DE RÉPONSE (JSON OBLIGATOIRE):
Tu DOIS TOUJOURS répondre avec du JSON valide dans ce format exact:

{
  "message": "Je modifie le titre principal.",
  "actions": [
    {
      "path": "index.html",
      "type": "replace",
      "search": "<h1>Ancien Titre</h1>",
      "content": "<h1>Nouveau Titre</h1>"
    }
  ]
}

TYPES D'ACTIONS:
- replace: remplace du texte EXACT
- insert-after: insère du contenu après une ligne de recherche
- insert-before: insère du contenu avant une ligne de recherche

RÈGLES ABSOLUES:
1. TOUJOURS retourner du JSON valide
2. Le tableau 'actions' NE DOIT JAMAIS être vide - génère au moins une action
3. Le paramètre 'search' DOIT être une copie EXACTE du code existant (respecte l'indentation)
4. Si aucune modification évidente, propose une amélioration pertinente
5. SOIS PRÉCIS: copie exactement ce qui existe dans 'search'
6. SOIS CONCIS: modifie uniquement ce qui est demandé`;

    const trivialPrompt = baseSystemPrompt + '\n\nMODE ULTRA-RAPIDE: Génère 1 action ciblée minimum. JSON obligatoire.';
    const simplePrompt = baseSystemPrompt + '\n\nMODE RAPIDE: Génère 1-3 actions simples. JSON obligatoire.';
    const complexPrompt = baseSystemPrompt + '\n\nMODE STANDARD: Modifications multiples possibles. JSON obligatoire.';

    const systemPrompt = complexity === 'trivial' ? trivialPrompt 
                       : complexity === 'simple' ? simplePrompt 
                       : complexPrompt;

    // === STREAMING AVEC GÉNÉRATION ÉVÉNEMENTS ===
    const startTime = Date.now();
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Contexte (fichiers pertinents):\n${minimalContext}\n\nTâche: ${message}\n\nRetourne les modifications XML uniquement.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[modify-site] API error:', response.status, errorText);
      
      const statusMessages: Record<number, string> = {
        400: 'Requête invalide',
        401: 'Authentification échouée',
        429: 'Limite de taux atteinte - réessayez dans un moment',
        500: 'Erreur API Claude'
      };
      
      return new Response(
        JSON.stringify({ error: statusMessages[response.status] || 'Échec de la génération' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === STREAM SSE AVEC ÉVÉNEMENTS DE GÉNÉRATION ===
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
        let eventsSent = false;
        
        try {
          // Envoyer événement initial
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_event',
            event: {
              type: 'analyze',
              message: `Analyse du code (${relevantFiles.length} fichier${relevantFiles.length > 1 ? 's' : ''})`,
              status: 'in-progress'
            }
          })}\n\n`));

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
                
                // Détecter début XML
                if ((delta.includes('<file') || delta.includes('<action')) && !inXmlSection) {
                  inXmlSection = true;
                  
                  // Envoyer événement d'édition
                  if (!eventsSent) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'generation_event',
                      event: {
                        type: 'edit',
                        message: 'Application des modifications',
                        status: 'in-progress'
                      }
                    })}\n\n`));
                    eventsSent = true;
                  }
                }
                
                // Stream conversationnel (avant XML)
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

          const duration = Date.now() - startTime;
          console.log(`[modify-site] Generation completed in ${duration}ms`);

          // === PARSER LE JSON ===
          let actions: Array<{path: string, type: string, search?: string, content?: string}> = [];
          let parsedMessage = conversationalResponse.trim();
          
          try {
            // Extraire le JSON de la réponse (peut être entouré de texte)
            const jsonMatch = fullResponse.match(/\{[\s\S]*?"actions"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);
            
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              actions = parsed.actions || [];
              parsedMessage = parsed.message || conversationalResponse.trim();
              console.log(`[modify-site] ✅ ${actions.length} action${actions.length > 1 ? 's' : ''} parsée${actions.length > 1 ? 's' : ''} depuis JSON`);
            } else {
              console.warn('[modify-site] ⚠️ Aucun JSON valide trouvé dans la réponse');
              console.log('[modify-site] Réponse brute:', fullResponse.substring(0, 500));
            }
          } catch (parseError) {
            console.error('[modify-site] ❌ Erreur parsing JSON:', parseError);
            console.log('[modify-site] Réponse brute:', fullResponse.substring(0, 500));
          }

          console.log(`[modify-site] ✅ ${actions.length} action${actions.length > 1 ? 's' : ''} finale${actions.length > 1 ? 's' : ''}`);

          // Mettre en cache pour patterns fréquents (seulement si trivial/simple)
          if (complexity === 'trivial' || complexity === 'simple') {
            patternCache.set(cacheKey, {
              response: { actions, message: conversationalResponse.trim() },
              timestamp: Date.now()
            });
            
            // Nettoyer le cache (garder max 50 entrées)
            if (patternCache.size > 50) {
              const oldestKey = Array.from(patternCache.keys())[0];
              patternCache.delete(oldestKey);
            }
          }

          // Événement de complétion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_event',
            event: {
              type: 'complete',
              message: `Modifications appliquées en ${duration}ms`,
              status: 'completed',
              duration
            }
          })}\n\n`));

          // Envoyer résultat final
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: { 
              actions,
              message: parsedMessage,
              duration
            }
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          console.error('[modify-site] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Erreur de génération' }
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
      JSON.stringify({ error: 'Échec de la modification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
