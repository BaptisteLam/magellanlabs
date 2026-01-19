import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeIntent } from "./analyze.ts";
import { 
  DependencyGraph, 
  optimizeContext, 
  extractExplicitFiles,
  buildContextWithMemory 
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
    const { message, projectFiles, sessionId, memory, conversationHistory } = await req.json();

    if (!message || !projectFiles || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: message, projectFiles, and sessionId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[unified-modify] Request received:', {
      messageLength: message.length,
      fileCount: Object.keys(projectFiles).length,
      sessionId,
      hasMemory: !!memory,
      hasConversationHistory: !!conversationHistory?.length,
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

          const analysis = analyzeIntent(message, projectFiles);
          
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'analyze',
            status: 'complete',
            message: `✅ Demande analysée (${analysis.complexity})`,
            data: analysis
          });

          // 🆕 Envoyer un message d'intention basé sur l'analyse
          const intentPreview = generateIntentPreview(message, analysis);
          sendEvent('message', {
            type: 'intent',
            content: intentPreview
          });

          console.log('[unified-modify] Analysis result:', analysis);

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

          const explicitFiles = extractExplicitFiles(message, projectFiles);
          
          // Max files based on complexity
          const maxFilesMap: Record<string, number> = {
            'trivial': 3,
            'simple': 8,
            'moderate': 12,
            'complex': 15
          };
          const maxFiles = maxFilesMap[analysis.complexity] || 10;

          const relevantFiles = graph.getRelevantFiles(explicitFiles, maxFiles);
          
          // Create subset of project files
          const relevantProjectFiles: Record<string, string> = {};
          for (const path of relevantFiles) {
            if (projectFiles[path]) {
              relevantProjectFiles[path] = projectFiles[path];
            }
          }

          const optimizedContext = optimizeContext(relevantProjectFiles, analysis.complexity);

          // 🆕 Envoyer les détails des fichiers identifiés
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'context',
            status: 'complete',
            message: `✅ ${Object.keys(optimizedContext.files).length} fichiers identifiés`,
            data: {
              explicitFiles,
              relevantFiles,
              fileCount: Object.keys(optimizedContext.files).length,
              truncatedFiles: optimizedContext.truncatedFiles
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

// 🆕 Génère un aperçu de l'intention basé sur l'analyse
function generateIntentPreview(message: string, analysis: any): string {
  const msgLower = message.toLowerCase();
  
  // Détecter la langue (simple heuristique)
  const isFrench = /\b(le|la|les|un|une|des|du|de|en|et|pour|avec|dans|sur|au|aux|ce|cette|ces|je|tu|il|elle|nous|vous|ils|elles|mon|ton|son|notre|votre|leur|qui|que|quoi|dont|où|changer|modifier|ajouter|supprimer|créer|mettre|faire)\b/i.test(message);
  
  if (isFrench) {
    // Messages contextuels en français
    if (msgLower.includes('couleur') || msgLower.includes('color')) {
      return `Je vais modifier les couleurs selon votre demande...`;
    }
    if (msgLower.includes('bouton') || msgLower.includes('button')) {
      return `Je vais modifier le(s) bouton(s) comme demandé...`;
    }
    if (msgLower.includes('titre') || msgLower.includes('header') || msgLower.includes('heading')) {
      return `Je vais modifier le titre/header selon vos instructions...`;
    }
    if (msgLower.includes('texte') || msgLower.includes('text')) {
      return `Je vais modifier le texte comme indiqué...`;
    }
    if (msgLower.includes('image') || msgLower.includes('photo') || msgLower.includes('logo')) {
      return `Je vais ajuster l'image/le logo selon votre demande...`;
    }
    if (msgLower.includes('taille') || msgLower.includes('size') || msgLower.includes('grand') || msgLower.includes('petit')) {
      return `Je vais ajuster les dimensions comme demandé...`;
    }
    if (msgLower.includes('police') || msgLower.includes('font')) {
      return `Je vais modifier la police/typographie...`;
    }
    if (msgLower.includes('ajouter') || msgLower.includes('créer') || msgLower.includes('add')) {
      return `Je vais ajouter le nouvel élément demandé...`;
    }
    if (msgLower.includes('supprimer') || msgLower.includes('enlever') || msgLower.includes('remove')) {
      return `Je vais supprimer l'élément indiqué...`;
    }
    return `Je vais traiter votre demande...`;
  } else {
    // Messages contextuels en anglais
    if (msgLower.includes('color') || msgLower.includes('colour')) {
      return `I'll modify the colors as requested...`;
    }
    if (msgLower.includes('button')) {
      return `I'll modify the button(s) as requested...`;
    }
    if (msgLower.includes('title') || msgLower.includes('header') || msgLower.includes('heading')) {
      return `I'll modify the title/header as instructed...`;
    }
    if (msgLower.includes('text')) {
      return `I'll modify the text as indicated...`;
    }
    if (msgLower.includes('image') || msgLower.includes('photo') || msgLower.includes('logo')) {
      return `I'll adjust the image/logo as requested...`;
    }
    if (msgLower.includes('size') || msgLower.includes('bigger') || msgLower.includes('smaller')) {
      return `I'll adjust the dimensions as requested...`;
    }
    if (msgLower.includes('font')) {
      return `I'll modify the font/typography...`;
    }
    if (msgLower.includes('add') || msgLower.includes('create')) {
      return `I'll add the new element as requested...`;
    }
    if (msgLower.includes('remove') || msgLower.includes('delete')) {
      return `I'll remove the indicated element...`;
    }
    return `I'll process your request...`;
  }
}
