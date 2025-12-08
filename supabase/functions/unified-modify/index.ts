import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeIntent } from "./analyze.ts";
import { 
  DependencyGraph, 
  optimizeContext, 
  extractExplicitFiles,
  buildContextWithMemory 
} from "./context.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, projectFiles, memory } = await req.json();

    console.log('[unified-modify] Request received:', {
      promptLength: prompt?.length || 0,
      fileCount: Object.keys(projectFiles || {}).length,
      hasMemory: !!memory,
    });

    // Phase 1: Analyse d'intention
    console.log('[unified-modify] Phase 1: Analyzing intent...');
    const analysis = analyzeIntent(prompt, projectFiles || {});
    console.log('[unified-modify] Analysis result:', analysis);

    // Phase 2: Construction du contexte
    console.log('[unified-modify] Phase 2: Building context...');
    
    // Extraire les fichiers explicitement mentionnés
    const explicitFiles = extractExplicitFiles(prompt, projectFiles || {});
    console.log('[unified-modify] Explicit files:', explicitFiles);

    // Construire le graphe de dépendances
    const graph = new DependencyGraph(projectFiles || {});
    const nodes = graph.buildGraph();
    console.log('[unified-modify] Dependency graph built with', nodes.size, 'nodes');

    // Obtenir les fichiers pertinents
    const relevantFiles = graph.getRelevantFiles(explicitFiles, 15);
    console.log('[unified-modify] Relevant files:', relevantFiles);

    // Filtrer les fichiers du projet pour ne garder que les pertinents
    const relevantProjectFiles: Record<string, string> = {};
    for (const path of relevantFiles) {
      if (projectFiles && projectFiles[path]) {
        relevantProjectFiles[path] = projectFiles[path];
      }
    }

    // Optimiser le contexte selon la complexité
    const optimizedContext = optimizeContext(relevantProjectFiles, analysis.complexity);
    console.log('[unified-modify] Context optimized:', {
      totalLines: optimizedContext.totalLines,
      optimizedLines: optimizedContext.optimizedLines,
      truncatedFiles: optimizedContext.truncatedFiles,
    });

    // Enrichir le prompt avec la mémoire
    const enrichedPrompt = buildContextWithMemory(prompt, projectFiles || {}, memory);

    // Retourner les résultats des phases 1 et 2
    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        context: {
          explicitFiles,
          relevantFiles,
          optimizedFiles: optimizedContext.files,
          truncatedFiles: optimizedContext.truncatedFiles,
          stats: {
            totalLines: optimizedContext.totalLines,
            optimizedLines: optimizedContext.optimizedLines,
            fileCount: Object.keys(optimizedContext.files).length,
          },
        },
        enrichedPrompt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[unified-modify] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
