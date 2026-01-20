import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeIntent } from "./analyze.ts";
import { 
  DependencyGraph, 
  optimizeContext, 
  extractExplicitFiles,
  buildContextWithMemory,
  scoreFilesByRelevance,
  selectFilesWithBudget
} from "./context.ts";
import {
  selectModel,
  buildSystemPrompt,
  generateWithStreaming,
  parseASTFromResponse,
} from "./generate.ts";
import {
  validateModifications,
  autoFixIssues,
  applyModifications,
  markAsCompleted,
} from "./validate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cache configuration
const CACHE_TTL = 600000; // 10 minutes
const CACHE_MAX_SIZE = 50;
const cache = new Map<string, { result: any; timestamp: number }>();

function getCacheKey(message: string, files: string[]): string {
  return `${message}::${files.sort().join(',')}`;
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.result;
}

function setCache(key: string, result: any): void {
  // LRU: remove oldest entry if cache is full
  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  
  cache.set(key, { result, timestamp: Date.now() });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { message, projectFiles, sessionId, memory: providedMemory, conversationHistory } = await req.json();

    if (!message || !projectFiles || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: message, projectFiles, and sessionId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // P0 CRITIQUE: Charger la mémoire depuis Supabase si non fournie
    let memory = providedMemory;
    if (!memory) {
      console.log('[unified-modify] Loading memory from Supabase for session:', sessionId);
      const { data: memoryData, error: memoryError } = await supabase
        .from('project_memory')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (memoryError) {
        console.warn('[unified-modify] Error loading memory:', memoryError);
      } else if (memoryData) {
        memory = memoryData.memory_data;
        console.log('[unified-modify] Loaded memory from Supabase:', {
          hasArchitecture: !!memory?.architecture,
          recentChangesCount: memory?.recentChanges?.length || 0,
          knownIssuesCount: memory?.knownIssues?.length || 0
        });
      }
    }

    console.log('[unified-modify] Request received:', {
      messageLength: message.length,
      fileCount: Object.keys(projectFiles).length,
      sessionId,
      hasMemory: !!memory,
      hasConversationHistory: !!conversationHistory?.length,
      conversationHistoryLength: conversationHistory?.length || 0,
    });

    // Check cache
    const fileKeys = Object.keys(projectFiles);
    const cacheKey = getCacheKey(message, fileKeys);
    const cachedResult = getFromCache(cacheKey);
    
    if (cachedResult) {
      console.log('[unified-modify] Cache HIT');
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Setup SSE streaming
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (eventName: string, data: any) => {
          const eventStr = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(eventStr));
        };

        try {
          // ========== PHASE 1: ANALYZE ==========
          console.log('[unified-modify] Phase 1: Analyzing intent...');
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'analyze',
            status: 'starting',
            message: '🔍 Analyse de votre demande...'
          });

          // P0: Passer l'historique de conversation pour analyse contextuelle
          const analysis = analyzeIntent(message, projectFiles, conversationHistory);
          
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'analyze',
            status: 'complete',
            message: `✅ Demande analysée (${analysis.complexity})`,
            data: {
              ...analysis,
              resolvedPrompt: analysis.resolvedPrompt,
              multiIntent: analysis.multiIntent
            }
          });

          // P0: Message d'intention intelligent avec extraction d'entités
          const intentPreview = generateSmartIntentMessage(message, analysis, []);
          sendEvent('message', {
            type: 'intent',
            content: intentPreview
          });

          console.log('[unified-modify] Analysis result:', {
            complexity: analysis.complexity,
            resolvedPrompt: analysis.resolvedPrompt,
            multiIntent: analysis.multiIntent?.intentions?.length
          });

          // ========== PHASE 2: CONTEXT ==========
          console.log('[unified-modify] Phase 2: Building context...');
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'context',
            status: 'starting',
            message: '📂 Identification des fichiers concernés...'
          });

          const graph = new DependencyGraph(projectFiles);
          graph.buildGraph();

          // P1: Utiliser le scoring hybride pour sélectionner les fichiers
          const fileScores = scoreFilesByRelevance(message, projectFiles, graph, conversationHistory);
          const explicitFiles = extractExplicitFiles(message, projectFiles);
          
          // P1: Sélection avec budget de tokens au lieu de limite fixe
          const relevantProjectFiles = selectFilesWithBudget(fileScores, projectFiles, analysis.complexity);
          
          // Ajouter les fichiers explicites s'ils ne sont pas déjà inclus
          for (const explicitFile of explicitFiles) {
            if (!relevantProjectFiles[explicitFile] && projectFiles[explicitFile]) {
              relevantProjectFiles[explicitFile] = projectFiles[explicitFile];
            }
          }

          const optimizedContext = optimizeContext(relevantProjectFiles, analysis.complexity);
          const relevantFiles = Object.keys(optimizedContext.files);

          // Envoyer les détails des fichiers identifiés avec scores
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'context',
            status: 'complete',
            message: `✅ ${relevantFiles.length} fichiers identifiés`,
            data: {
              explicitFiles,
              relevantFiles,
              fileCount: relevantFiles.length,
              truncatedFiles: optimizedContext.truncatedFiles,
              topScores: fileScores.slice(0, 5).map(f => ({ path: f.path, score: f.total }))
            }
          });

          // Envoyer les fichiers qui seront modifiés
          for (const filePath of relevantFiles.slice(0, 5)) {
            sendEvent('generation_event', {
              type: 'file_identified',
              file: filePath,
              message: `📄 ${filePath}`
            });
          }

          console.log('[unified-modify] Context built:', {
            explicitFiles: explicitFiles.length,
            relevantFiles: relevantFiles.length,
            optimizedFiles: Object.keys(optimizedContext.files).length
          });

          // ========== PHASE 3: GENERATION ==========
          console.log('[unified-modify] Phase 3: Generating modifications...');
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'generation',
            status: 'starting',
            message: '✨ Génération des modifications...'
          });

          const modelConfig = selectModel(analysis.complexity);
          console.log('[unified-modify] Selected model:', modelConfig);

          // P0: Enrichir le prompt système avec l'historique de conversation
          const systemPrompt = buildSystemPrompt(
            analysis.complexity,
            optimizedContext.files,
            memory ? JSON.stringify(memory) : undefined,
            conversationHistory
          );

          const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
          if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
          }

          const generationResult = await generateWithStreaming(
            apiKey,
            modelConfig,
            systemPrompt,
            message,
            (chunk) => {
              // Ne pas envoyer les chunks de streaming pour éviter le spam
              // sendEvent('generation_event', { type: 'stream', chunk });
            }
          );

          sendEvent('tokens', {
            input: generationResult.inputTokens,
            output: generationResult.outputTokens,
            total: generationResult.inputTokens + generationResult.outputTokens
          });

          const parsed = parseASTFromResponse(generationResult.fullResponse);

          // 🆕 Envoyer le message d'intention contextuel de Claude
          if (parsed.intentMessage) {
            sendEvent('message', {
              type: 'intent_detailed',
              content: parsed.intentMessage
            });
          }

          sendEvent('generation_event', {
            type: 'phase',
            phase: 'generation',
            status: 'complete',
            message: `✅ ${parsed.modifications.length} modifications générées`
          });

          if (!parsed.modifications || parsed.modifications.length === 0) {
            sendEvent('error', {
              message: 'No modifications generated',
              details: parsed.message
            });
            controller.close();
            return;
          }

          // 🆕 Envoyer les détails des fichiers affectés
          for (const fileAffected of parsed.filesAffected || []) {
            sendEvent('generation_event', {
              type: 'file_modified',
              file: fileAffected.path,
              description: fileAffected.description,
              changeType: fileAffected.changeType,
              message: `✏️ ${fileAffected.path}: ${fileAffected.description}`
            });
          }

          console.log('[unified-modify] Generated modifications:', parsed.modifications.length);

          // ========== PHASE 4: VALIDATION ==========
          console.log('[unified-modify] Phase 4: Validating modifications...');
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'validation',
            status: 'starting',
            message: '🔍 Validation des modifications...'
          });

          let modifications = parsed.modifications;
          let validation = validateModifications(modifications, projectFiles);

          if (!validation.allValid) {
            console.warn('[unified-modify] Validation failed, attempting auto-fix...');
            sendEvent('message', {
              type: 'autofix',
              content: '🔧 Correction automatique en cours...'
            });

            modifications = autoFixIssues(modifications, projectFiles);
            validation = validateModifications(modifications, projectFiles);

            if (!validation.allValid) {
              sendEvent('error', {
                message: 'Validation failed after auto-fix',
                errors: validation.errors
              });
              controller.close();
              return;
            }
          }

          const applyResult = applyModifications(modifications, projectFiles);

          if (!applyResult.success) {
            sendEvent('error', {
              message: 'Failed to apply modifications',
              errors: applyResult.errors
            });
            controller.close();
            return;
          }

          sendEvent('generation_event', {
            type: 'phase',
            phase: 'validation',
            status: 'complete',
            message: '✅ Modifications validées et appliquées'
          });

          // ========== COMPLETION ==========
          const duration = Date.now() - startTime;

          // 🆕 Utiliser le message contextuel de Claude au lieu d'un message générique
          const completionMessage = parsed.message || markAsCompleted(modifications.length, duration);

          sendEvent('message', {
            type: 'completion',
            content: completionMessage
          });

          const finalResult = {
            success: true,
            modifications,
            updatedFiles: applyResult.updatedFiles,
            message: completionMessage,
            intentMessage: parsed.intentMessage,
            filesAffected: parsed.filesAffected,
            tokens: {
              input: generationResult.inputTokens,
              output: generationResult.outputTokens,
              total: generationResult.inputTokens + generationResult.outputTokens
            },
            duration,
            analysis: {
              complexity: analysis.complexity,
              intentType: analysis.intentType,
              confidence: analysis.confidence
            }
          };

          sendEvent('complete', finalResult);

          // P0 CRITIQUE: Sauvegarder la mémoire mise à jour dans Supabase
          try {
            const updatedMemory = {
              architecture: memory?.architecture || {},
              recentChanges: [
                ...(memory?.recentChanges || []),
                {
                  timestamp: new Date().toISOString(),
                  prompt: message,
                  intentMessage: parsed.intentMessage,
                  filesAffected: parsed.filesAffected?.map((f: any) => f.path) || [],
                  modificationsCount: modifications.length,
                }
              ].slice(-50), // Garder les 50 dernières modifications
              knownIssues: memory?.knownIssues || [],
              userPreferences: memory?.userPreferences || {},
            };

            const { error: upsertError } = await supabase
              .from('project_memory')
              .upsert({
                session_id: sessionId,
                memory_data: updatedMemory,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'session_id' });

            if (upsertError) {
              console.warn('[unified-modify] Error saving memory:', upsertError);
            } else {
              console.log('[unified-modify] Memory saved successfully');
            }
          } catch (memoryError) {
            console.warn('[unified-modify] Error in memory save:', memoryError);
          }

          // Cache result for trivial/simple requests
          if (analysis.complexity === 'trivial' || analysis.complexity === 'simple') {
            setCache(cacheKey, finalResult);
            console.log('[unified-modify] Result cached');
          }

          console.log('[unified-modify] Completed successfully in', duration, 'ms');
          controller.close();

        } catch (error) {
          console.error('[unified-modify] Error:', error);
          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
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
    console.error('[unified-modify] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// P2: Extraction d'entités du prompt pour messages contextuels
function extractEntities(text: string): {
  actions: string[];
  elements: string[];
  colors: string[];
  properties: string[];
} {
  const entities = {
    actions: [] as string[],
    elements: [] as string[],
    colors: [] as string[],
    properties: [] as string[]
  };
  
  const textLower = text.toLowerCase();
  
  // Actions
  const actionPatterns: Array<{ pattern: RegExp; action: string }> = [
    { pattern: /\b(chang|modifi)/i, action: 'changer' },
    { pattern: /\b(ajout|add|créer|create)/i, action: 'ajouter' },
    { pattern: /\b(supprim|enlev|retir|remove|delete)/i, action: 'supprimer' },
    { pattern: /\b(remplac|replace)/i, action: 'remplacer' },
    { pattern: /\b(augment|agrandi|bigger|larger)/i, action: 'agrandir' },
    { pattern: /\b(réduir|diminue|smaller)/i, action: 'réduire' },
    { pattern: /\b(center|centr)/i, action: 'centrer' },
    { pattern: /\b(align)/i, action: 'aligner' },
  ];
  
  for (const { pattern, action } of actionPatterns) {
    if (pattern.test(textLower)) {
      entities.actions.push(action);
    }
  }
  
  // Éléments UI
  const elementPatterns: Array<{ pattern: RegExp; element: string }> = [
    { pattern: /bouton|button|btn|cta/i, element: 'bouton' },
    { pattern: /titre|title|heading|h1|h2|h3/i, element: 'titre' },
    { pattern: /header|en-?tête|navbar/i, element: 'header' },
    { pattern: /footer|pied/i, element: 'footer' },
    { pattern: /menu|nav(igation)?/i, element: 'navigation' },
    { pattern: /card|carte/i, element: 'carte' },
    { pattern: /image|photo|logo|icon/i, element: 'image' },
    { pattern: /form(ulaire)?|input|champ/i, element: 'formulaire' },
    { pattern: /texte|text|paragraph/i, element: 'texte' },
    { pattern: /section|bloc|div/i, element: 'section' },
    { pattern: /hero|banner|bannière/i, element: 'hero' },
    { pattern: /fond|background|bg/i, element: 'fond' },
    { pattern: /lien|link/i, element: 'lien' },
  ];
  
  for (const { pattern, element } of elementPatterns) {
    if (pattern.test(textLower)) {
      entities.elements.push(element);
    }
  }
  
  // Couleurs
  const colorPatterns = [
    /\b(bleu|blue|#[0-9a-f]{3,6}|rgb\([^)]+\))/i,
    /\b(rouge|red)/i,
    /\b(vert|green)/i,
    /\b(jaune|yellow)/i,
    /\b(orange)/i,
    /\b(violet|purple)/i,
    /\b(rose|pink)/i,
    /\b(noir|black)/i,
    /\b(blanc|white)/i,
    /\b(gris|gray|grey)/i,
    /\b(foncé|dark|sombre)/i,
    /\b(clair|light)/i,
  ];
  
  for (const pattern of colorPatterns) {
    const match = textLower.match(pattern);
    if (match) {
      entities.colors.push(match[0]);
    }
  }
  
  // Propriétés CSS
  const propertyPatterns: Array<{ pattern: RegExp; property: string }> = [
    { pattern: /taille|size|dimension/i, property: 'taille' },
    { pattern: /police|font/i, property: 'police' },
    { pattern: /marge|margin|padding|espacement/i, property: 'espacement' },
    { pattern: /bordure|border|contour/i, property: 'bordure' },
    { pattern: /arrondi|radius|rounded/i, property: 'arrondi' },
    { pattern: /ombre|shadow/i, property: 'ombre' },
    { pattern: /opacité|opacity|transparent/i, property: 'opacité' },
    { pattern: /animation|transition|effet/i, property: 'animation' },
  ];
  
  for (const { pattern, property } of propertyPatterns) {
    if (pattern.test(textLower)) {
      entities.properties.push(property);
    }
  }
  
  return entities;
}

// P2: Génère un message d'intention intelligent basé sur extraction d'entités
function generateSmartIntentMessage(
  prompt: string,
  analysis: any,
  targetFiles: string[]
): string {
  const entities = extractEntities(prompt);
  const isFrench = /\b(le|la|les|un|une|des|du|de|en|et|pour|avec|dans|sur|changer|modifier|ajouter)\b/i.test(prompt);
  
  // Construire le message contextuel
  const action = entities.actions[0] || (isFrench ? 'modifier' : 'modify');
  const element = entities.elements[0] || (isFrench ? 'les éléments' : 'the elements');
  const color = entities.colors[0];
  const property = entities.properties[0];
  
  // Construire la partie fichiers
  let filesStr = '';
  if (targetFiles.length > 0) {
    const shortFiles = targetFiles.slice(0, 2).map(f => f.split('/').pop()).join(', ');
    filesStr = isFrench ? ` dans ${shortFiles}` : ` in ${shortFiles}`;
  }
  
  // Construire le message complet
  if (isFrench) {
    let msg = `Je vais ${action} ${element}`;
    if (color) msg += ` en ${color}`;
    else if (property) msg += ` (${property})`;
    msg += filesStr + '...';
    return msg;
  } else {
    let msg = `I'll ${action} ${element}`;
    if (color) msg += ` to ${color}`;
    else if (property) msg += ` (${property})`;
    msg += filesStr + '...';
    return msg;
  }
}

// Fonction legacy pour compatibilité
function generateIntentPreview(message: string, analysis: any): string {
  return generateSmartIntentMessage(message, analysis, []);
}
