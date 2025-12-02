import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════
// CACHE INTELLIGENT (de modify-site)
// ═══════════════════════════════════════════════════════════
const patternCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface ProjectFile {
  path: string;
  content: string;
}

interface DependencyNode {
  path: string;
  imports: string[];
  exports: string[];
  usedBy: string[];
  importance: number;
  type: 'component' | 'hook' | 'util' | 'page' | 'config' | 'other';
}

// ═══════════════════════════════════════════════════════════
// DEPENDENCY GRAPH (d'agent-v2)
// ═══════════════════════════════════════════════════════════
class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();

  async buildGraph(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      const node = await this.parseFile(path, content);
      this.nodes.set(path, node);
    }
    this.calculateReverseEdges();
    this.calculateImportance();
  }

  getRelevantFiles(targetFiles: string[], maxFiles = 15): string[] {
    const relevant = new Set<string>(targetFiles);
    const visited = new Set<string>();

    for (const file of targetFiles) {
      this.addRelatedFiles(file, relevant, visited, 2);
    }

    return Array.from(relevant)
      .sort((a, b) => {
        const scoreA = this.nodes.get(a)?.importance ?? 0;
        const scoreB = this.nodes.get(b)?.importance ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, maxFiles);
  }

  private addRelatedFiles(
    filePath: string,
    relevant: Set<string>,
    visited: Set<string>,
    depth: number
  ): void {
    if (depth === 0 || visited.has(filePath)) return;
    visited.add(filePath);

    const node = this.nodes.get(filePath);
    if (!node) return;

    node.imports.forEach(imp => {
      relevant.add(imp);
      this.addRelatedFiles(imp, relevant, visited, depth - 1);
    });

    node.usedBy.forEach(user => {
      relevant.add(user);
      this.addRelatedFiles(user, relevant, visited, depth - 1);
    });
  }

  private async parseFile(path: string, content: string): Promise<DependencyNode> {
    const imports = this.extractImports(content, path);
    const exports = this.extractExports(content);
    const type = this.detectFileType(path);

    return { path, imports, exports, usedBy: [], importance: 0, type };
  }

  private extractImports(content: string, fromPath: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], fromPath);
      if (resolved) imports.push(resolved);
    }

    return Array.from(new Set(imports));
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    if (/export\s+default/.test(content)) exports.push('default');

    return Array.from(new Set(exports));
  }

  private resolveImportPath(importPath: string, fromPath: string): string | null {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) return null;

    if (importPath.startsWith('@/')) {
      return this.addExtensionIfNeeded(importPath.replace('@/', 'src/'));
    }

    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
      const resolved = this.normalizePath(`${fromDir}/${importPath}`);
      return this.addExtensionIfNeeded(resolved);
    }

    return null;
  }

  private addExtensionIfNeeded(path: string): string {
    if (/\.(tsx?|jsx?)$/.test(path)) return path;

    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    for (const ext of extensions) {
      if (this.nodes.has(path + ext)) return path + ext;
    }

    return path + '.tsx';
  }

  private normalizePath(path: string): string {
    const parts = path.split('/');
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '..') normalized.pop();
      else if (part !== '.' && part !== '') normalized.push(part);
    }

    return normalized.join('/');
  }

  private calculateReverseEdges(): void {
    for (const node of this.nodes.values()) {
      node.usedBy = [];
    }

    for (const [path, node] of this.nodes) {
      for (const importPath of node.imports) {
        const importedNode = this.nodes.get(importPath);
        if (importedNode) importedNode.usedBy.push(path);
      }
    }
  }

  private calculateImportance(): void {
    for (const [path, node] of this.nodes) {
      let score = 0;

      score += node.usedBy.length * 10;
      score += node.exports.length * 5;

      if (this.isCriticalFile(path)) score += 50;

      switch (node.type) {
        case 'component': score += 5; break;
        case 'hook': score += 8; break;
        case 'page': score += 15; break;
        case 'config': score += 20; break;
      }

      if (path.includes('src/components/')) score += 3;

      node.importance = score;
    }
  }

  private isCriticalFile(path: string): boolean {
    const patterns = ['App.tsx', 'main.tsx', 'index.tsx', 'router', 'routes', 'config', 'constants', 'types', 'supabase/client'];
    return patterns.some(p => path.includes(p));
  }

  private detectFileType(path: string): DependencyNode['type'] {
    if (path.includes('/components/') && !path.includes('/ui/')) return 'component';
    if (path.includes('/hooks/')) return 'hook';
    if (path.includes('/pages/')) return 'page';
    if (path.includes('/utils/') || path.includes('/lib/') || path.includes('/services/')) return 'util';
    if (path.includes('config') || path.includes('constants') || path.includes('types')) return 'config';
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function extractFileReferences(prompt: string, files: ProjectFile[]): string[] {
  const mentioned: string[] = [];
  const lowerPrompt = prompt.toLowerCase();

  files.forEach(file => {
    const fileName = file.path.split('/').pop()?.toLowerCase() || '';
    const fileNameNoExt = fileName.replace(/\.(tsx?|jsx?|css)$/, '');

    if (lowerPrompt.includes(fileName) || lowerPrompt.includes(fileNameNoExt)) {
      mentioned.push(file.path);
    }
  });

  return mentioned;
}

function optimizeContext(files: ProjectFile[], complexity: string): string {
  const maxLines = complexity === 'trivial' ? 100
                 : complexity === 'simple' ? 150
                 : 250;

  return files
    .map((f: ProjectFile) => {
      const lines = f.content.split('\n');

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
}

function buildMemoryContext(memory: any): string {
  if (!memory) return '';

  return `# PROJECT MEMORY

## Architecture
Framework: ${memory.architecture?.framework || 'Unknown'}
Patterns: ${memory.architecture?.patterns?.join(', ') || 'None'}

## Recent Changes (Last 3)
${memory.recentChanges?.slice(0, 3).map((change: any) =>
  `- ${change.description}\n  Files: ${change.filesAffected?.join(', ')}`
).join('\n') || 'No recent changes'}

## Known Issues
${memory.knownIssues?.slice(0, 3).map((issue: any) =>
  `- ${issue.issue}\n  Solution: ${issue.solution}`
).join('\n') || 'No known issues'}

## User Preferences
Coding Style: ${memory.userPreferences?.codingStyle || 'Not specified'}
`;
}

// ═══════════════════════════════════════════════════════════
// VALIDATION (d'agent-v2)
// ═══════════════════════════════════════════════════════════

function validateModifications(modifications: any[], projectFiles: Record<string, string>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Vérifier que les fichiers cibles existent
  for (const mod of modifications) {
    if (!projectFiles[mod.path]) {
      errors.push(`File not found: ${mod.path}`);
    }
  }

  // Vérifier structure AST
  for (const mod of modifications) {
    if (!mod.path || !mod.fileType || !mod.type) {
      errors.push(`Invalid AST structure in modification`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════

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

    const { message, projectFiles, sessionId, complexity, memory } = await req.json();

    if (!message || !projectFiles) {
      return new Response(
        JSON.stringify({ error: 'message and projectFiles required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[unified-modify] Message: ${message.length} chars, Complexity: ${complexity || 'unknown'}`);

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: CHECK CACHE (pour trivial)
    // ═══════════════════════════════════════════════════════════
    if (complexity === 'trivial') {
      const cacheKey = `${message.toLowerCase().trim()}_${Object.keys(projectFiles).length}`;
      const cached = patternCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log('[unified-modify] ⚡ Cache hit!');
        return new Response(
          JSON.stringify({ type: 'complete', data: cached.response }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: BUILD CONTEXT INTELLIGENT
    // ═══════════════════════════════════════════════════════════

    const projectFilesArray: ProjectFile[] = Object.entries(projectFiles).map(([path, content]) => ({
      path,
      content: content as string
    }));

    // A. Extraire fichiers explicites
    const explicitFiles = extractFileReferences(message, projectFilesArray);
    console.log(`[unified-modify] Explicit files: ${explicitFiles.length}`);

    // B. Build dependency graph
    const graph = new DependencyGraph();
    await graph.buildGraph(projectFiles);
    console.log(`[unified-modify] Dependency graph built`);

    // C. Get relevant files avec scores
    const relevantFilePaths = explicitFiles.length > 0
      ? graph.getRelevantFiles(explicitFiles, 15)
      : Object.keys(projectFiles).slice(0, 5); // Fallback: premiers 5 fichiers

    const relevantFiles = relevantFilePaths
      .map(path => ({ path, content: projectFiles[path] }))
      .filter(f => f.content);

    console.log(`[unified-modify] Relevant files: ${relevantFiles.length}`);

    // D. Memory context
    const memoryContext = buildMemoryContext(memory);

    // E. Optimize context (token savings)
    const optimizedContext = optimizeContext(relevantFiles, complexity || 'simple');

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: GÉNÉRATION ADAPTATIVE
    // ═══════════════════════════════════════════════════════════

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // A. Sélection modèle adaptatif
    let model = 'claude-sonnet-4-5';
    let maxTokens = 4000;
    let temperature = 0.3;

    if (complexity === 'trivial') {
      model = 'claude-3-5-haiku-20241022';
      maxTokens = 2000;
      temperature = 0.2;
      console.log('[unified-modify] Using Haiku for trivial modification');
    } else if (complexity === 'simple') {
      maxTokens = 3000;
      console.log('[unified-modify] Using Sonnet (reduced tokens) for simple modification');
    } else {
      maxTokens = 5000;
      console.log('[unified-modify] Using Sonnet (full) for complex modification');
    }

    // B. System prompt (AST format)
    const systemPrompt = `${memoryContext ? memoryContext + '\n\n' : ''}Tu es un assistant de modification de code ultra-rapide et précis utilisant l'AST (Abstract Syntax Tree).

FORMAT DE RÉPONSE (JSON AST OBLIGATOIRE):
Tu DOIS TOUJOURS répondre avec du JSON valide dans ce format exact:

{
  "message": "Je vais changer la couleur du titre en bleu",
  "modifications": [
    {
      "path": "styles.css",
      "fileType": "css",
      "type": "update",
      "target": {
        "selector": "h1",
        "property": "color"
      },
      "value": "blue"
    }
  ]
}

RÈGLE CRITIQUE POUR LE MESSAGE:
Le champ "message" est OBLIGATOIRE et doit décrire l'action que tu vas accomplir en une phrase courte, précise et contextuelle.

TYPES DE MODIFICATIONS AST:
- update: Modifier une propriété/attribut/valeur existante
- insert: Insérer un nouvel élément/propriété
- delete: Supprimer un élément/propriété
- replace: Remplacer un élément entier

FILE TYPES:
- "css": Pour fichiers CSS (styles.css)
- "html": Pour fichiers HTML (index.html)
- "js": Pour fichiers JavaScript (script.js)
- "jsx": Pour fichiers React JSX

RÈGLES ABSOLUES:
1. TOUJOURS retourner du JSON valide avec un champ "message" descriptif
2. Le tableau 'modifications' NE DOIT JAMAIS être vide - génère au moins une modification
3. Utilise la structure AST appropriée pour le type de fichier
4. SOIS PRÉCIS: identifie exactement l'élément cible
5. SOIS CONCIS: modifie uniquement ce qui est demandé`;

    // C. Streaming SSE
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
            content: `Contexte (fichiers pertinents):\n${optimizedContext}\n\nTâche: ${message}\n\nRetourne les modifications en JSON uniquement.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[unified-modify] API error:', response.status, errorText);

      return new Response(
        JSON.stringify({ error: 'Échec de la génération' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: STREAMING + VALIDATION
    // ═══════════════════════════════════════════════════════════

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
        let inputTokens = 0;
        let outputTokens = 0;

        try {
          // Envoyer événement initial
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_event',
            event: {
              type: 'analyze',
              message: `Analyse intelligente (${relevantFiles.length} fichiers pertinents)`,
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

                if (json.type === 'message_start') {
                  inputTokens = json.message?.usage?.input_tokens || 0;
                }

                if (json.type === 'message_delta') {
                  outputTokens = json.usage?.output_tokens || 0;
                }

                const delta = json?.delta?.text || '';
                if (delta) {
                  fullResponse += delta;

                  // Stream conversationnel
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'message',
                    content: delta
                  })}\n\n`));
                }
              } catch (e) {
                console.error('[unified-modify] Parse error:', e);
              }
            }
          }

          const duration = Date.now() - startTime;
          console.log(`[unified-modify] Generation completed in ${duration}ms`);

          // ═══════════════════════════════════════════════════════════
          // PARSE AST + VALIDATION
          // ═══════════════════════════════════════════════════════════

          let modifications: Array<any> = [];
          let parsedMessage = '';

          try {
            const jsonMatch = fullResponse.match(/\{[\s\S]*?"modifications"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);

            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              modifications = parsed.modifications || [];
              parsedMessage = parsed.message || '';
              console.log(`[unified-modify] ✅ ${modifications.length} modifications AST parsed`);
            } else {
              console.warn('[unified-modify] ⚠️ No valid JSON AST found');
            }
          } catch (parseError) {
            console.error('[unified-modify] ❌ JSON parsing error:', parseError);
          }

          // VALIDATION
          const validation = validateModifications(modifications, projectFiles);

          if (!validation.valid) {
            console.error('[unified-modify] ❌ Validation failed:', validation.errors);

            // Envoyer événement d'erreur
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'generation_event',
              event: {
                type: 'error',
                message: `Validation échouée: ${validation.errors.join(', ')}`,
                status: 'error'
              }
            })}\n\n`));

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              data: { message: 'Validation failed', errors: validation.errors }
            })}\n\n`));

            controller.close();
            return;
          }

          console.log(`[unified-modify] ✅ Validation passed`);

          // Émettre tokens
          const totalTokens = inputTokens + outputTokens;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'tokens',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens
          })}\n\n`));

          // Cache pour trivial/simple
          if (complexity === 'trivial' || complexity === 'simple') {
            const cacheKey = `${message.toLowerCase().trim()}_${Object.keys(projectFiles).length}`;
            patternCache.set(cacheKey, {
              response: { modifications, message: parsedMessage },
              timestamp: Date.now()
            });

            if (patternCache.size > 50) {
              const oldestKey = Array.from(patternCache.keys())[0];
              patternCache.delete(oldestKey);
            }
          }

          // ÉVÉNEMENT DE COMPLÉTION (seulement si validation OK)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_event',
            event: {
              type: 'complete',
              message: `Modifications validées en ${duration}ms`,
              status: 'completed',
              duration
            }
          })}\n\n`));

          // Résultat final
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: {
              modifications,
              message: parsedMessage,
              duration,
              validated: true
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
