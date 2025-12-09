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
    const { message, projectFiles, sessionId, memory } = await req.json();

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
            message: 'Analyzing request complexity...'
          });

          const analysis = analyzeIntent(message, projectFiles);
          
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'analyze',
            status: 'complete',
            data: analysis
          });

          sendEvent('message', {
            type: 'intent',
            content: `Complexity detected: ${analysis.complexity} (${analysis.intentType})`
          });

          console.log('[unified-modify] Analysis result:', analysis);

          // ========== PHASE 2: CONTEXT ==========
          console.log('[unified-modify] Phase 2: Building context...');
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'context',
            status: 'starting',
            message: 'Building intelligent context...'
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

          sendEvent('generation_event', {
            type: 'phase',
            phase: 'context',
            status: 'complete',
            data: {
              explicitFiles,
              relevantFiles,
              fileCount: Object.keys(optimizedContext.files).length,
              truncatedFiles: optimizedContext.truncatedFiles
            }
          });

          sendEvent('message', {
            type: 'context',
            content: `Context built with ${Object.keys(optimizedContext.files).length} files`
          });

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
            message: 'Generating AST modifications...'
          });

          const modelConfig = selectModel(analysis.complexity);
          console.log('[unified-modify] Selected model:', modelConfig);

          const systemPrompt = buildSystemPrompt(
            analysis.complexity,
            optimizedContext.files,
            memory ? JSON.stringify(memory) : undefined
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
              sendEvent('generation_event', {
                type: 'stream',
                chunk
              });
            }
          );

          sendEvent('tokens', {
            input: generationResult.inputTokens,
            output: generationResult.outputTokens,
            total: generationResult.inputTokens + generationResult.outputTokens
          });

          sendEvent('generation_event', {
            type: 'phase',
            phase: 'generation',
            status: 'complete',
            message: 'AST modifications generated'
          });

          const parsed = parseASTFromResponse(generationResult.fullResponse);

          if (!parsed.modifications || parsed.modifications.length === 0) {
            sendEvent('error', {
              message: 'No modifications generated',
              details: parsed.message
            });
            controller.close();
            return;
          }

          sendEvent('message', {
            type: 'generation',
            content: parsed.message
          });

          console.log('[unified-modify] Generated modifications:', parsed.modifications.length);

          // ========== PHASE 4: VALIDATION ==========
          console.log('[unified-modify] Phase 4: Validating modifications...');
          sendEvent('generation_event', {
            type: 'phase',
            phase: 'validation',
            status: 'starting',
            message: 'Validating and applying modifications...'
          });

          let modifications = parsed.modifications;
          let validation = validateModifications(modifications, projectFiles);

          if (!validation.allValid) {
            console.warn('[unified-modify] Validation failed, attempting auto-fix...');
            sendEvent('message', {
              type: 'autofix',
              content: 'Auto-fixing validation issues...'
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
            message: 'Modifications validated and applied'
          });

          // ========== COMPLETION ==========
          const duration = Date.now() - startTime;
          const completionMessage = markAsCompleted(modifications.length, duration);

          sendEvent('message', {
            type: 'completion',
            content: completionMessage
          });

          const finalResult = {
            success: true,
            modifications,
            updatedFiles: applyResult.updatedFiles,
            message: parsed.message,
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
