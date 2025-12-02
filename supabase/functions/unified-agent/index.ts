import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= TYPES =============
interface UnifiedRequest {
  message: string;
  projectFiles: Record<string, string>;
  sessionId: string;
  projectType: 'website' | 'webapp' | 'mobile';
  mode?: 'auto' | 'chat' | 'quick' | 'full';
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  chatHistory?: Array<{ role: string; content: string }>;
  memoryContext?: string;
}

interface Snapshot {
  files: Record<string, string>;
  timestamp: number;
  sessionId: string;
}

type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex';
type ExecutionMode = 'chat' | 'quick' | 'full';

// ============= COMPLEXITY ANALYZER =============
function analyzeComplexity(message: string, projectFiles: Record<string, string>): { 
  complexity: ComplexityLevel; 
  mode: ExecutionMode;
  score: number;
  confidence: number;
} {
  const lowerMessage = message.toLowerCase();
  const fileCount = Object.keys(projectFiles).length;
  
  // Chat-only indicators
  const chatIndicators = [
    'explique', 'explain', 'pourquoi', 'why', 'comment', 'how does',
    'qu\'est-ce', 'what is', 'aide', 'help', 'conseils', 'advice',
    'propose', 'suggest', 'plan', 'stratégie', 'strategy'
  ];
  
  if (chatIndicators.some(i => lowerMessage.includes(i)) && 
      !lowerMessage.includes('change') && 
      !lowerMessage.includes('modifie') &&
      !lowerMessage.includes('ajoute') &&
      !lowerMessage.includes('crée')) {
    return { complexity: 'trivial', mode: 'chat', score: 0, confidence: 90 };
  }
  
  // First generation (no files)
  if (fileCount === 0) {
    return { complexity: 'complex', mode: 'full', score: 100, confidence: 100 };
  }
  
  // Trivial changes (single property changes)
  const trivialPatterns = [
    /change.*coul/i, /color.*change/i, /couleur/i,
    /change.*text/i, /modifie.*text/i, /texte/i,
    /taille.*police/i, /font.*size/i,
    /padding|margin|spacing/i,
    /border.*radius/i, /arrondi/i
  ];
  
  const isTrivial = trivialPatterns.some(p => p.test(message));
  
  // Simple changes (single file, few modifications)
  const simplePatterns = [
    /ajoute.*bouton/i, /add.*button/i,
    /modifie.*style/i, /change.*style/i,
    /update.*header/i, /modifie.*header/i,
    /ajoute.*section/i, /add.*section/i
  ];
  
  const isSimple = simplePatterns.some(p => p.test(message));
  
  // Complex changes (multiple files, structural changes)
  const complexPatterns = [
    /refactor/i, /restructure/i,
    /nouvelle.*page/i, /new.*page/i,
    /authentification/i, /authentication/i,
    /base.*données/i, /database/i,
    /api.*intégration/i, /api.*integration/i,
    /tout.*modifier/i, /change.*everything/i
  ];
  
  const isComplex = complexPatterns.some(p => p.test(message));
  
  // Calculate score
  let score = 30; // Base score
  
  if (isTrivial) score = 10;
  else if (isSimple) score = 30;
  else if (isComplex) score = 80;
  
  // Adjust based on message length
  if (message.length > 500) score += 20;
  if (message.length > 1000) score += 30;
  
  // Adjust based on file mentions
  const filesmentioned = Object.keys(projectFiles).filter(path => 
    message.toLowerCase().includes(path.toLowerCase().split('/').pop()?.split('.')[0] || '')
  );
  if (filesmentioned.length > 3) score += 20;
  
  // Determine mode and complexity
  let complexity: ComplexityLevel;
  let mode: ExecutionMode;
  
  if (score <= 20) {
    complexity = 'trivial';
    mode = 'quick';
  } else if (score <= 40) {
    complexity = 'simple';
    mode = 'quick';
  } else if (score <= 70) {
    complexity = 'moderate';
    mode = 'quick'; // Still try quick first, fallback to full
  } else {
    complexity = 'complex';
    mode = 'full';
  }
  
  const confidence = Math.min(95, 60 + (100 - score) / 2);
  
  return { complexity, mode, score, confidence };
}

// ============= FILE RELEVANCE ANALYZER =============
function identifyRelevantFiles(
  message: string, 
  projectFiles: Record<string, string>,
  maxFiles: number = 10
): Array<{ path: string; content: string; score: number }> {
  const lowerMessage = message.toLowerCase();
  const scoredFiles: Array<{ path: string; content: string; score: number }> = [];
  
  for (const [path, content] of Object.entries(projectFiles)) {
    let score = 0;
    const fileName = path.split('/').pop()?.toLowerCase() || '';
    const baseName = fileName.split('.')[0];
    
    // Direct mention in message
    if (lowerMessage.includes(baseName)) score += 50;
    if (lowerMessage.includes(fileName)) score += 60;
    
    // File type relevance
    if (path.endsWith('.css') && /style|couleur|color|design|css/i.test(message)) score += 40;
    if (path.endsWith('.html') && /html|page|section|header|footer/i.test(message)) score += 40;
    if (path.endsWith('.js') && /javascript|script|fonction|function|click|event/i.test(message)) score += 40;
    
    // Critical files always included
    if (['index.html', 'styles.css', 'script.js', 'App.tsx', 'main.tsx'].includes(fileName)) {
      score += 30;
    }
    
    // Content relevance (search for keywords in content)
    const keywords = message.split(/\s+/).filter(w => w.length > 3);
    keywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        score += 5;
      }
    });
    
    if (score > 0) {
      scoredFiles.push({ path, content, score });
    }
  }
  
  // Sort by score and limit
  return scoredFiles
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);
}

// ============= SYSTEM PROMPTS =============
const SYSTEM_PROMPT_QUICK = `Tu es un expert développeur web. Tu effectues des modifications PRÉCISES et CIBLÉES sur le code existant.

RÈGLES CRITIQUES:
1. Modifie UNIQUEMENT ce qui est demandé
2. Préserve TOUT le reste du code intact
3. Réponds en JSON avec ce format EXACT:

{
  "message": "Description courte de ce que tu as fait",
  "modifications": [
    {
      "path": "chemin/fichier.ext",
      "fileType": "css|html|js",
      "type": "update",
      "target": {
        "selector": "sélecteur CSS ou élément HTML",
        "property": "propriété CSS (si CSS)",
        "attribute": "attribut HTML (si HTML)"
      },
      "value": "nouvelle valeur"
    }
  ]
}

TYPES DE MODIFICATIONS:
- CSS: selector + property + value (ex: {"selector": "h1", "property": "color", "value": "#03A5C0"})
- HTML attribute: selector + attribute + value
- HTML content: selector + value (pour textContent)
- JS: identifier + value

⚠️ JAMAIS de code complet, UNIQUEMENT des modifications AST ciblées.`;

const SYSTEM_PROMPT_FULL_WEBSITE = `Tu es un expert développeur web qui génère des sites web statiques en HTML, CSS et JavaScript pur.

RÈGLES ABSOLUES - FICHIERS SÉPARÉS:
1. Tu DOIS créer 3 fichiers distincts : **index.html**, **styles.css**, **script.js**
2. ORDRE OBLIGATOIRE: styles.css → script.js → index.html → autres pages
3. ❌ INTERDIT: CSS ou JS inline dans HTML
4. ✅ HTML ne contient QUE <link href="styles.css"> et <script src="script.js">

MINIMUM REQUIS:
- styles.css: 200+ lignes avec reset, variables, typography, layout, animations, media queries
- script.js: 80+ lignes avec menu mobile, scroll effects, form handling
- index.html: Structure sémantique complète

FORMAT DE RÉPONSE - NDJSON (une ligne = un objet JSON):
{"type":"message","content":"Description de ce que tu vas faire"}
{"type":"status","content":"Task: Création des styles"}
{"type":"code_update","path":"styles.css","code":"/* code complet */"}
{"type":"code_update","path":"script.js","code":"// code complet"}
{"type":"code_update","path":"index.html","code":"<!DOCTYPE html>..."}
{"type":"complete"}

DESIGN:
- Utilise des images Unsplash contextuelles (https://images.unsplash.com/photo-[ID]?w=1200&q=80)
- Couleur principale: #03A5C0
- Design sobre et professionnel adapté au contexte
- ❌ AUCUN emoji - utilise des icônes SVG professionnelles`;

const SYSTEM_PROMPT_CHAT = `Tu es un assistant expert en développement web. Tu aides l'utilisateur à planifier et concevoir son projet.

RÈGLES:
1. Propose des plans détaillés et structurés avec des étapes numérotées
2. Donne des conseils techniques précis
3. Explique les compromis et alternatives
4. Termine TOUJOURS par un bouton d'implémentation si tu proposes des modifications

FORMAT DE RÉPONSE - NDJSON:
{"type":"message","content":"Ta réponse complète en Markdown avec le plan détaillé"}
{"type":"tokens","input_tokens":X,"output_tokens":Y,"total_tokens":Z}
{"type":"complete"}

À la fin de tes recommandations techniques, propose: "Cliquez sur 'Implémenter le plan' pour appliquer ces modifications."`;

// ============= SNAPSHOT MANAGEMENT =============
function createSnapshot(files: Record<string, string>, sessionId: string): Snapshot {
  return {
    files: JSON.parse(JSON.stringify(files)), // Deep clone
    timestamp: Date.now(),
    sessionId
  };
}

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: UnifiedRequest = await req.json();
    const { 
      message, 
      projectFiles = {}, 
      sessionId, 
      projectType = 'website',
      mode = 'auto',
      attachedFiles = [],
      chatHistory = [],
      memoryContext
    } = request;

    console.log('[unified-agent] Request:', { 
      messageLength: message?.length, 
      fileCount: Object.keys(projectFiles).length,
      projectType,
      mode
    });

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // 1. ANALYZE complexity and determine execution mode
    const analysis = analyzeComplexity(message, projectFiles);
    const executionMode: ExecutionMode = mode === 'auto' ? analysis.mode : mode as ExecutionMode;
    
    console.log('[unified-agent] Analysis:', { 
      complexity: analysis.complexity, 
      mode: executionMode,
      score: analysis.score,
      confidence: analysis.confidence
    });

    // 2. CREATE SNAPSHOT for atomic rollback
    const snapshot = createSnapshot(projectFiles, sessionId);
    console.log('[unified-agent] Snapshot created at:', snapshot.timestamp);

    // 3. SELECT relevant files
    const relevantFiles = identifyRelevantFiles(message, projectFiles, 10);
    console.log('[unified-agent] Relevant files:', relevantFiles.map(f => f.path));

    // 4. BUILD context
    const filesContext = relevantFiles
      .map(f => `=== ${f.path} ===\n${f.content.slice(0, 3000)}`)
      .join('\n\n');

    const historyContext = chatHistory
      .slice(-6)
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 500) : '[complex content]'}`)
      .join('\n');

    // 5. SELECT system prompt based on mode
    let systemPrompt: string;
    let model = 'claude-sonnet-4-20250514';
    
    if (executionMode === 'chat') {
      systemPrompt = SYSTEM_PROMPT_CHAT;
      model = 'claude-3-5-haiku-20241022'; // Faster for chat
    } else if (executionMode === 'quick') {
      systemPrompt = SYSTEM_PROMPT_QUICK;
      model = 'claude-3-5-haiku-20241022'; // Fast for quick mods
    } else {
      systemPrompt = projectType === 'website' ? SYSTEM_PROMPT_FULL_WEBSITE : SYSTEM_PROMPT_FULL_WEBSITE;
      model = 'claude-sonnet-4-20250514'; // Full power for generation
    }

    // Add context to prompt
    const fullPrompt = `
${memoryContext ? `MEMORY CONTEXT:\n${memoryContext}\n\n` : ''}
PROJECT FILES (${Object.keys(projectFiles).length} total):
${filesContext || 'No files yet (first generation)'}

${historyContext ? `CONVERSATION HISTORY:\n${historyContext}\n\n` : ''}

USER REQUEST:
${message}

${attachedFiles.length > 0 ? `\nATTACHED FILES: ${attachedFiles.map(f => f.name).join(', ')}` : ''}
`;

    // 6. STREAM response from Claude
    const encoder = new TextEncoder();
    let inputTokens = 0;
    let outputTokens = 0;
    
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Send initial status
          sendEvent({ 
            type: 'status', 
            content: executionMode === 'chat' 
              ? 'Analyzing your question...'
              : executionMode === 'quick'
              ? 'Preparing quick modification...'
              : 'Starting full generation...'
          });

          sendEvent({
            type: 'analysis',
            data: {
              complexity: analysis.complexity,
              mode: executionMode,
              confidence: analysis.confidence,
              relevantFiles: relevantFiles.map(f => f.path)
            }
          });

          // Call Claude API with streaming
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model,
              max_tokens: executionMode === 'chat' ? 4096 : 8192,
              system: systemPrompt,
              messages: [{ role: 'user', content: fullPrompt }],
              stream: true
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${errorText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response stream');

          const decoder = new TextDecoder();
          let buffer = '';
          let fullResponse = '';
          let currentCodePath = '';
          let currentCode = '';
          let inCodeBlock = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]' || !data) continue;

              try {
                const event = JSON.parse(data);
                
                if (event.type === 'message_start') {
                  inputTokens = event.message?.usage?.input_tokens || 0;
                }
                
                if (event.type === 'content_block_delta') {
                  const text = event.delta?.text || '';
                  fullResponse += text;
                  
                  // Parse NDJSON events in real-time
                  const responseLines = fullResponse.split('\n');
                  for (const responseLine of responseLines) {
                    if (!responseLine.trim()) continue;
                    
                    try {
                      // Try to parse as JSON event
                      if (responseLine.startsWith('{') && responseLine.endsWith('}')) {
                        const parsed = JSON.parse(responseLine);
                        
                        if (parsed.type === 'message') {
                          sendEvent({ type: 'message', content: parsed.content });
                        } else if (parsed.type === 'status') {
                          sendEvent({ type: 'status', content: parsed.content });
                        } else if (parsed.type === 'code_update') {
                          sendEvent({ 
                            type: 'code_update', 
                            path: parsed.path, 
                            code: parsed.code 
                          });
                        }
                      }
                    } catch {
                      // Not valid JSON yet, continue accumulating
                    }
                  }
                }
                
                if (event.type === 'message_delta') {
                  outputTokens = event.usage?.output_tokens || outputTokens;
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }

          // Handle quick mode JSON response
          if (executionMode === 'quick') {
            try {
              // Extract JSON from response
              const jsonMatch = fullResponse.match(/\{[\s\S]*"modifications"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                sendEvent({ type: 'message', content: parsed.message || 'Modifications applied' });
                
                // Send AST modifications
                sendEvent({
                  type: 'ast_modifications',
                  data: {
                    modifications: parsed.modifications || [],
                    message: parsed.message
                  }
                });
              } else {
                // Fallback: no valid JSON, signal need for full generation
                sendEvent({
                  type: 'fallback_required',
                  reason: 'No valid AST modifications generated'
                });
              }
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              sendEvent({
                type: 'fallback_required',
                reason: 'Failed to parse AST modifications'
              });
            }
          }

          // Send token usage
          sendEvent({
            type: 'tokens',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens
          });

          // Send completion
          sendEvent({
            type: 'complete',
            data: {
              mode: executionMode,
              snapshot_timestamp: snapshot.timestamp
            }
          });

          controller.close();

        } catch (error) {
          console.error('[unified-agent] Error:', error);
          
          // Send rollback signal with snapshot
          sendEvent({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            snapshot: snapshot // Include snapshot for rollback
          });
          
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
    });

  } catch (error) {
    console.error('[unified-agent] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
