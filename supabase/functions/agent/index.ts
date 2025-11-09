import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IntentAnalysis = {
  type: "intent";
  action: "generate_code" | "modify_code" | "add_feature" | "explain" | "chat";
  target?: string;
  description: string;
};

type AIEvent =
  | { type: "status"; content: string }
  | { type: "message"; content: string }
  | IntentAnalysis
  | { type: "code_update"; path: string; code: string }
  | { type: "complete" };

// Génère un résumé du projet (< 600 tokens)
function generateProjectSummary(projectFiles: Record<string, string>): string {
  const fileNames = Object.keys(projectFiles);
  const summary = `Projet contenant ${fileNames.length} fichiers:\n` +
    fileNames.slice(0, 15).map(f => `- ${f}`).join('\n');
  
  return summary.slice(0, 2000); // Limite approximative
}

// Étape 1 : Analyse d'intention avec OpenAI (léger, avec résumé)
async function analyzeIntent(
  userMessage: string, 
  chatHistory: Array<{ role: string; content: string }>,
  projectSummary: string
): Promise<IntentAnalysis> {
  console.log('🔍 Analyse d\'intention avec OpenAI...');
  
  const recentHistory = chatHistory.slice(-3);
  const contextPrompt = `Résumé du projet:\n${projectSummary}\n\nConversation récente:\n${
    recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')
  }`;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant qui analyse les intentions utilisateur pour un builder de site web.
Réponds UNIQUEMENT avec un JSON au format:
{
  "type": "intent",
  "action": "generate_code" | "modify_code" | "add_feature" | "explain" | "chat",
  "target": "chemin/fichier.tsx" (optionnel, si modification d'un fichier spécifique),
  "description": "description claire de la tâche"
}

Actions:
- generate_code: créer un nouveau site/composant complet
- modify_code: modifier un fichier existant
- add_feature: ajouter une nouvelle fonctionnalité
- explain: expliquer quelque chose sans code
- chat: conversation générale`
        },
        { role: 'user', content: `${contextPrompt}\n\nNouvelle demande: ${userMessage}` }
      ],
      temperature: 0.3,
      max_tokens: 300
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Erreur OpenAI:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const intent = JSON.parse(content);
    console.log('✅ Intention détectée:', intent);
    return intent;
  } catch (e) {
    console.error('❌ Erreur parsing intention:', content);
    return {
      type: "intent",
      action: "chat",
      description: userMessage
    };
  }
}

// Génère une réponse conversationnelle avec OpenAI
async function generateConversationalResponse(
  userMessage: string,
  intent: IntentAnalysis,
  chatHistory: Array<{ role: string; content: string }>,
  isInitial: boolean = true
): Promise<string> {
  const recentHistory = chatHistory.slice(-3);
  
  const systemPrompt = isInitial 
    ? `Tu es un assistant de développement web. L'utilisateur vient de demander quelque chose et tu vas lancer une tâche.
Réponds en UNE SEULE PHRASE courte et naturelle pour confirmer ce que tu vas faire, SANS détails techniques.
Exemples:
- "Je vais modifier le header pour changer la couleur."
- "D'accord, je crée une nouvelle page de contact."
- "Compris, j'ajoute cette fonctionnalité."`
    : `Tu es un assistant de développement web. Tu viens de terminer une tâche de code.
Résume en UNE SEULE PHRASE courte ce qui a été fait, de manière naturelle et concise.
Exemples:
- "J'ai modifié le header avec la nouvelle couleur."
- "La page de contact est créée."
- "La fonctionnalité est ajoutée et prête."`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { 
          role: 'user', 
          content: isInitial 
            ? `Demande: ${userMessage}\nIntention détectée: ${intent.description}` 
            : `Tâche terminée: ${intent.description}`
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    }),
  });

  if (!response.ok) {
    return isInitial 
      ? "Je m'occupe de votre demande." 
      : "C'est fait.";
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Étape 2 : Génération/modification avec Claude Sonnet 4.5
async function* generateWithClaude(
  intent: IntentAnalysis,
  projectFiles: Record<string, string>,
  relevantFiles: Array<{ path: string; content: string }>,
  chatHistory: Array<{ role: string; content: string }>
): AsyncGenerator<AIEvent> {
  console.log('🤖 Génération avec Claude Sonnet 4.5...');
  
  const projectSummary = generateProjectSummary(projectFiles);
  
  const systemPrompt = `Tu es un développeur expert qui génère et modifie du code pour des sites web React/TypeScript.
Tu DOIS répondre UNIQUEMENT avec des événements NDJSON (une ligne = un objet JSON).

Types d'événements disponibles:
- {"type":"status","content":"message de statut"}
- {"type":"message","content":"message conversationnel"}
- {"type":"code_update","path":"chemin/fichier.tsx","code":"code complet du fichier"}
- {"type":"complete"}

IMPORTANT:
- Renvoie le CODE COMPLET de chaque fichier modifié/créé avec type="code_update"
- Un événement par ligne (NDJSON)
- Pas de markdown, pas de \`\`\`, juste du JSON valide
- Termine toujours par {"type":"complete"}`;

  let userPrompt = `Résumé du projet:\n${projectSummary}\n\n`;
  
  if (relevantFiles.length > 0) {
    userPrompt += `Fichiers concernés:\n`;
    relevantFiles.forEach(f => {
      userPrompt += `\n--- ${f.path} ---\n${f.content}\n`;
    });
  }
  
  userPrompt += `\nTâche: ${intent.description}`;
  if (intent.target) {
    userPrompt += `\nFichier cible: ${intent.target}`;
  }

  const messages: any[] = [
    { role: 'assistant', content: systemPrompt }
  ];

  // Ajouter l'historique (fenêtre glissante des 3 derniers messages)
  const recentHistory = chatHistory.slice(-3);
  messages.push(...recentHistory.map(m => ({ role: m.role, content: m.content })));
  
  messages.push({ role: 'user', content: userPrompt });

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
      max_tokens: 8000,
      stream: true,
      messages: messages.filter(m => m.role !== 'assistant' || m !== messages[0])
        .map(m => m.role === 'assistant' ? { role: 'user', content: `[System] ${m.content}` } : m),
      system: systemPrompt,
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

  try {
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
                const aiEvent = JSON.parse(eventLine) as AIEvent;
                yield aiEvent;
              } catch (e) {
                console.error('⚠️ Erreur parsing event:', eventLine, e);
              }
            }
            
            // Garder la dernière ligne incomplète dans le buffer
            buffer = eventLines[eventLines.length - 1];
          }
        } catch (e) {
          console.error('⚠️ Erreur parsing SSE:', line, e);
        }
      }
    }

    // Parser le dernier buffer
    if (buffer.trim()) {
      const eventLines = buffer.split('\n');
      for (const eventLine of eventLines) {
        if (!eventLine.trim()) continue;
        try {
          const aiEvent = JSON.parse(eventLine) as AIEvent;
          yield aiEvent;
        } catch (e) {
          console.error('⚠️ Erreur parsing final event:', eventLine, e);
        }
      }
    }

  } finally {
    reader.releaseLock();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      projectFiles = {}, 
      relevantFiles = [],
      chatHistory = [],
      sessionId 
    } = await req.json();

    console.log('🚀 Agent API called:', { message, filesCount: Object.keys(projectFiles).length });

    if (!OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
      throw new Error('API keys not configured');
    }

    // Créer un stream de réponse
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Générateur d'événements principal
          async function* mainFlow() {
            yield { type: 'status', content: 'Analyse de votre demande...' } as AIEvent;
            
            const projectSummary = generateProjectSummary(projectFiles);
            const intent = await analyzeIntent(message, chatHistory, projectSummary);
            yield intent;

            if (intent.action === 'chat' || intent.action === 'explain') {
              const conversationResponse = await generateConversationalResponse(message, intent, chatHistory, true);
              yield { type: 'message', content: conversationResponse } as AIEvent;
              yield { type: 'complete' } as AIEvent;
              return;
            }

            // Message initial conversationnel
            const initialMessage = await generateConversationalResponse(message, intent, chatHistory, true);
            yield { type: 'message', content: initialMessage } as AIEvent;
            
            yield { type: 'status', content: 'Génération du code...' } as AIEvent;
            
            for await (const event of generateWithClaude(intent, projectFiles, relevantFiles, chatHistory)) {
              yield event;
            }

            // Message final conversationnel
            const finalMessage = await generateConversationalResponse(message, intent, chatHistory, false);
            yield { type: 'message', content: finalMessage } as AIEvent;
          }

          // Envoyer tous les événements
          for await (const event of mainFlow()) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
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
