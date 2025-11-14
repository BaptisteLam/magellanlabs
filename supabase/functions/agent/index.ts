import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      projectFiles = {}, 
      chatHistory = [],
      sessionId 
    } = await req.json();

    console.log('🚀 Agent API called:', { message, filesCount: Object.keys(projectFiles).length });

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Construire contexte projet (limiter la taille)
    const projectContext = Object.entries(projectFiles)
      .slice(0, 20) // Limiter à 20 fichiers max
      .map(([path, content]) => `=== ${path} ===\n${typeof content === 'string' ? content.slice(0, 2000) : content}`)
      .join('\n\n');

    // Construire historique (garder les 5 derniers messages)
    const recentHistory = chatHistory.slice(-5);
    const historyContext = recentHistory
      .map((m: any) => `${m.role}: ${m.content.substring(0, 500)}`)
      .join('\n');

    const systemPrompt = `Tu es un expert développeur React/TypeScript qui génère et modifie du code pour des sites web.

PROJET ACTUEL:
${projectContext || 'Projet vide - première génération'}

HISTORIQUE DE CONVERSATION:
${historyContext || 'Aucun historique'}

FORMAT DE RÉPONSE OBLIGATOIRE - Tu DOIS répondre avec des événements NDJSON (une ligne = un objet JSON):

Types d'événements disponibles:
1. {"type":"message","content":"Message conversationnel pour l'utilisateur"}
2. {"type":"status","content":"Task: Titre de la tâche"} ou {"type":"status","content":"Titre: Détail de l'étape"}
3. {"type":"code_update","path":"chemin/fichier.tsx","code":"code complet du fichier"}
4. {"type":"complete"}

FLUX DE RÉPONSE:
1. Commence par un {"type":"message","content":"Message naturel expliquant ce que tu vas faire"}
2. Envoie des événements {"type":"status"} pour montrer la progression des tâches
3. Envoie des {"type":"code_update"} pour chaque fichier créé/modifié avec le code COMPLET
4. Termine par {"type":"message","content":"Résumé de ce qui a été fait"}
5. Finis par {"type":"complete"}

RÈGLES DE CODE:
- Nouvelle app/site : crée TOUS les fichiers nécessaires (App.tsx, composants, styles, etc.)
- Modification : modifie UNIQUEMENT les fichiers concernés avec leur code COMPLET
- Utilise React + TypeScript + Tailwind CSS
- NE JAMAIS générer de boutons de changement de thème flottants ou en position fixe
- NE JAMAIS générer de boutons "scroll to top" ou "retour en haut"
- NE PAS ajouter d'éléments UI superposés sauf si explicitement demandé
- Code propre, fonctionnel et sans widgets inutiles
- Pas de markdown, pas de \`\`\`, juste du JSON valide NDJSON

IMAGES LIBRES DE DROIT - OBLIGATOIRE:
- Tu DOIS TOUJOURS utiliser des images réelles et pertinentes provenant d'Unsplash
- JAMAIS d'images placeholder génériques (pas de placeholder.svg, pas de /placeholder.svg, pas de ?height=X&width=Y)
- Utilise le format Unsplash Source API: https://source.unsplash.com/{largeur}x{hauteur}/?{mots-clés}
- Exemples d'URLs à utiliser:
  * Hero/bannière: https://source.unsplash.com/1920x1080/?{sujet-pertinent}
  * Images de section: https://source.unsplash.com/800x600/?{sujet-pertinent}
  * Portraits/avatars: https://source.unsplash.com/400x400/?portrait,professional
  * Produits: https://source.unsplash.com/600x600/?{type-produit}
- Les mots-clés doivent être EN ANGLAIS et pertinents au contexte (ex: technology, business, nature, food, etc.)
- Pour les images multiples dans une même section, ajoute des mots-clés variés pour avoir des images différentes
- Exemples concrets:
  * Site tech: https://source.unsplash.com/1920x1080/?technology,innovation
  * Site restaurant: https://source.unsplash.com/1920x1080/?restaurant,food
  * Équipe: https://source.unsplash.com/400x400/?portrait,business,person
  * Portfolio: https://source.unsplash.com/800x600/?creative,design,workspace

IMPORTANT:
- Une ligne = un objet JSON
- Commence toujours par un message conversationnel
- Utilise des événements "status" pour montrer la progression (Task: titre, puis titre: détail)
- Renvoie le CODE COMPLET de chaque fichier avec "code_update"
- Termine toujours par un message final puis {"type":"complete"}

Exemple de flux:
{"type":"message","content":"Je vais créer votre site web."}
{"type":"status","content":"Task: Setting up project structure"}
{"type":"status","content":"Setting up project structure: Creating main App component"}
{"type":"code_update","path":"src/App.tsx","code":"import React from 'react'..."}
{"type":"status","content":"Task: Styling components"}
{"type":"status","content":"Styling components: Applying Tailwind CSS"}
{"type":"message","content":"Le site est créé et prêt."}
{"type":"complete"}`;

    // Créer un stream de réponse
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          console.log('📤 Envoi à Claude Sonnet 4.5...');

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY!,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: 16000, // Augmenté pour éviter les coupures
              stream: true,
              system: systemPrompt,
              messages: [
                ...recentHistory,
                { role: 'user', content: message }
              ],
              temperature: 1.0, // Ajout pour plus de créativité
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            console.error('❌ Erreur Claude:', error);
            throw new Error(`Claude API error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No stream reader');

          const decoder = new TextDecoder();
          let buffer = '';

          let hasReceivedComplete = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const event = JSON.parse(data);
                
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  buffer += event.delta.text;
                  
                  // Parser les événements NDJSON du buffer
                  const eventLines = buffer.split('\n');
                  
                  for (let i = 0; i < eventLines.length - 1; i++) {
                    const eventLine = eventLines[i].trim();
                    if (!eventLine) continue;
                    
                    try {
                      const aiEvent = JSON.parse(eventLine);
                      
                      // Tracker si on a reçu complete
                      if (aiEvent.type === 'complete') {
                        hasReceivedComplete = true;
                      }
                      
                      const data = `data: ${JSON.stringify(aiEvent)}\n\n`;
                      controller.enqueue(encoder.encode(data));
                    } catch (e: any) {
                      console.warn('⚠️ Erreur parsing event:', eventLine.substring(0, 100), e?.message);
                    }
                  }
                  
                  // Garder la dernière ligne incomplète dans le buffer
                  buffer = eventLines[eventLines.length - 1];
                }
              } catch (e: any) {
                console.warn('⚠️ Erreur parsing SSE:', line.substring(0, 100), e?.message);
              }
            }
          }

          // Parser le dernier buffer
          if (buffer.trim()) {
            const eventLines = buffer.split('\n');
            for (const eventLine of eventLines) {
              if (!eventLine.trim()) continue;
              try {
                const aiEvent = JSON.parse(eventLine);
                
                // Tracker si on a reçu complete
                if (aiEvent.type === 'complete') {
                  hasReceivedComplete = true;
                }
                
                const data = `data: ${JSON.stringify(aiEvent)}\n\n`;
                controller.enqueue(encoder.encode(data));
              } catch (e: any) {
                console.warn('⚠️ Erreur parsing final buffer:', eventLine.substring(0, 100), e?.message);
              }
            }
          }

          // S'assurer qu'on envoie toujours un événement complete
          if (!hasReceivedComplete) {
            console.log('⚠️ Aucun événement complete reçu de Claude, envoi forcé');
            const completeEvent = `data: ${JSON.stringify({ type: 'complete' })}\n\n`;
            controller.enqueue(encoder.encode(completeEvent));
          }

          controller.close();
          
        } catch (error) {
          console.error('❌ Erreur dans le stream:', error);
          const errorEvent = { 
            type: 'status', 
            content: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
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
    console.error('❌ Erreur agent API:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
