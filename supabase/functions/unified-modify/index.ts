/**
 * UNIFIED-MODIFY: Système hybride unifié
 * Combine le meilleur d'Agent-V2 et Modify-Site
 *
 * Architecture:
 * PHASE 1: Analyse (Intent + Complexity)
 * PHASE 2: Contexte (Graph + Memory + Optimization)
 * PHASE 3: Génération (Model selection + AST)
 * PHASE 4: Validation (Validation + Auto-fix + Application)
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

import { analyzeIntent } from './analyze.ts';
import {
  DependencyGraph,
  optimizeContext,
  extractExplicitFiles,
  buildMemoryContext
} from './context.ts';
import {
  selectModel,
  buildSystemPrompt,
  generateWithStreaming,
  parseASTFromResponse
} from './generate.ts';
import {
  validateModifications,
  autoFixIssues,
  applyModifications,
  markAsCompleted
} from './validate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache en mémoire pour patterns fréquents
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

    const { message, projectFiles, sessionId, memory } = await req.json();

    if (!message || !projectFiles) {
      return new Response(
        JSON.stringify({ error: 'message and projectFiles required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[unified-modify] Request: ${message.length} chars, ${Object.keys(projectFiles).length} files`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const startTime = Date.now();

    // ═══════════════════════════════════════
    // PHASE 1: ANALYSE INTELLIGENTE
    // ═══════════════════════════════════════

    const analysis = analyzeIntent(message, projectFiles);
    const { complexity } = analysis;

    console.log(`[unified-modify] Complexity: ${complexity}`);

    // Check cache pour patterns fréquents
    const cacheKey = `${message.toLowerCase().trim()}_${Object.keys(projectFiles).length}`;
    const cached = patternCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL && complexity === 'trivial') {
      console.log('[unified-modify] ⚡ Cache hit!');
      return new Response(
        JSON.stringify({ type: 'complete', data: cached.response }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════
    // PHASE 2: CONTEXTE INTELLIGENT
    // ═══════════════════════════════════════

    // A. Build dependency graph
    const graph = new DependencyGraph();
    await graph.buildGraph(projectFiles);
    console.log('[unified-modify] Dependency graph built');

    // B. Extract explicit files from prompt
    const explicitFiles = extractExplicitFiles(message, projectFiles);
    console.log(`[unified-modify] Explicit files: ${explicitFiles.length}`);

    // C. Get relevant files using graph
    const maxFiles = complexity === 'trivial' ? 3
      : complexity === 'simple' ? 5
      : complexity === 'moderate' ? 10
      : 15;

    const relevantFilePaths = explicitFiles.length > 0
      ? graph.getRelevantFiles(explicitFiles, maxFiles)
      : Object.keys(projectFiles).slice(0, maxFiles);

    const relevantFiles = relevantFilePaths.map(path => ({
      path,
      content: projectFiles[path]
    }));

    console.log(`[unified-modify] Selected ${relevantFiles.length} files`);

    // D. Build memory context
    const memoryContext = buildMemoryContext(memory);

    // E. Optimize context (truncate intelligently)
    const optimizedContext = optimizeContext(relevantFiles, complexity);

    // ═══════════════════════════════════════
    // PHASE 3: GÉNÉRATION ADAPTATIVE
    // ═══════════════════════════════════════

    const modelConfig = selectModel(complexity);
    console.log(`[unified-modify] Using model: ${modelConfig.model}`);

    const systemPrompt = buildSystemPrompt(complexity, memoryContext);
    const userPrompt = `Contexte (fichiers pertinents):\n${optimizedContext}\n\nTâche: ${message}\n\nRetourne les modifications en JSON uniquement.`;

    // Streaming SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Envoyer événement initial
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_event',
            event: {
              type: 'analyze',
              message: `Analyse du code (${relevantFiles.length} fichiers)`,
              status: 'in-progress'
            }
          })}\n\n`));

          let inXmlSection = false;
          let eventsSent = false;

          // Generate with streaming
          const { fullResponse, inputTokens, outputTokens } = await generateWithStreaming(
            ANTHROPIC_API_KEY!,
            modelConfig.model,
            modelConfig.maxTokens,
            modelConfig.temperature,
            systemPrompt,
            userPrompt,
            (chunk) => {
              // Détecter début XML/JSON
              if (chunk.text.includes('{') && !inXmlSection) {
                inXmlSection = true;

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

              // Stream conversationnel (avant XML/JSON)
              if (!inXmlSection) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'message',
                  content: chunk.text
                })}\n\n`));
              }
            }
          );

          const duration = Date.now() - startTime;
          console.log(`[unified-modify] Generation completed in ${duration}ms`);

          // Parse AST
          const { modifications, message: parsedMessage, error: parseError } = parseASTFromResponse(fullResponse);

          // Emit tokens
          const totalTokens = inputTokens + outputTokens;
          console.log(`[unified-modify] Tokens: input=${inputTokens}, output=${outputTokens}, total=${totalTokens}`);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'tokens',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens
          })}\n\n`));

          // ❌ Si parsing a échoué
          if (parseError || modifications.length === 0) {
            const errorMessage = parseError || 'Aucune modification générée';
            console.error(`[unified-modify] ❌ ${errorMessage}`);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              data: { message: errorMessage, duration }
            })}\n\n`));

            controller.close();
            return;
          }

          console.log(`[unified-modify] ✅ ${modifications.length} modifications parsed`);

          // ═══════════════════════════════════════
          // PHASE 4: VALIDATION & APPLICATION
          // ═══════════════════════════════════════

          // A. Validate
          const validation = validateModifications(modifications, projectFiles);

          // B. Auto-fix si nécessaire
          let finalModifications = modifications;
          if (!validation.allValid) {
            console.log('⚠️ Validation errors detected, auto-fixing...');
            finalModifications = await autoFixIssues(modifications, validation);

            // Re-validate
            const revalidation = validateModifications(finalModifications, projectFiles);
            if (!revalidation.allValid) {
              console.error('❌ Cannot fix validation errors');
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                data: { message: 'Validation failed after auto-fix', errors: revalidation.errors, duration }
              })}\n\n`));
              controller.close();
              return;
            }
          }

          // C. Apply (simulation - l'application réelle est côté frontend via AST parsers)
          const applyResult = await applyModifications(projectFiles, finalModifications);

          if (!applyResult.success) {
            console.error('❌ Application failed');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              data: { message: 'Failed to apply modifications', errors: applyResult.errors, duration }
            })}\n\n`));
            controller.close();
            return;
          }

          // D. Cache result (seulement si trivial/simple ET succès)
          if (complexity === 'trivial' || complexity === 'simple') {
            patternCache.set(cacheKey, {
              response: { modifications: finalModifications, message: parsedMessage },
              timestamp: Date.now()
            });

            if (patternCache.size > 50) {
              const oldestKey = Array.from(patternCache.keys())[0];
              patternCache.delete(oldestKey);
            }
          }

          // ═══════════════════════════════════════
          // MARK AS COMPLETED ✅
          // ═══════════════════════════════════════

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_event',
            event: {
              type: 'complete',
              message: `${finalModifications.length} modification${finalModifications.length > 1 ? 's' : ''} appliquée${finalModifications.length > 1 ? 's' : ''}`,
              status: 'completed',
              duration
            }
          })}\n\n`));

          // Envoyer résultat final
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: {
              modifications: finalModifications,
              message: parsedMessage,
              duration
            }
          })}\n\n`));

          controller.close();
        } catch (error) {
          console.error('[unified-modify] Stream error:', error);
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
    console.error('[unified-modify] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Échec de la modification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
