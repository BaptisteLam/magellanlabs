// Phase 3: Génération adaptative avec sélection de modèle et messages contextuels

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";
import { AnalysisResult } from "./analyze.ts";

export interface ModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ASTModification {
  type: 'css-change' | 'html-change' | 'jsx-change';
  path: string;
  target?: string;
  property?: string;
  attribute?: string;
  value?: string;
  changes?: Record<string, string>;
}

export interface FileAffected {
  path: string;
  description: string;
  changeType: 'modified' | 'created' | 'deleted';
}

export interface GenerationResult {
  intentMessage: string;
  message: string;
  modifications: ASTModification[];
  filesAffected: FileAffected[];
}

export interface StreamingResult {
  fullResponse: string;
  inputTokens: number;
  outputTokens: number;
}

// Sélection adaptative du modèle selon la complexité
export function selectModel(complexity: AnalysisResult['complexity']): ModelConfig {
  switch (complexity) {
    case 'trivial':
      return {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 2000,
        temperature: 0.2,
      };
    case 'simple':
      return {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 3000,
        temperature: 0.3,
      };
    case 'moderate':
      return {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 4000,
        temperature: 0.3,
      };
    case 'complex':
      return {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 5000,
        temperature: 0.3,
      };
    default:
      return {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 4000,
        temperature: 0.3,
      };
  }
}

// Construction du prompt système enrichi pour messages contextuels
export function buildSystemPrompt(
  complexity: AnalysisResult['complexity'],
  projectFiles: Record<string, string>,
  projectMemory?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): string {
  const complexityInstructions = getComplexityInstructions(complexity);
  
  let filesContext = '';
  for (const [path, content] of Object.entries(projectFiles)) {
    filesContext += `\n========== FILE: ${path} ==========\n${content}\n`;
  }
  
  const memorySection = projectMemory 
    ? `\n## Project Memory\n${projectMemory}\n` 
    : '';
  
  // P0: Ajouter l'historique de conversation enrichi au contexte
  let conversationSection = '';
  if (conversationHistory && conversationHistory.length > 0) {
    // Formater les messages récents avec métadonnées pour contexte enrichi
    const formattedHistory = conversationHistory
      .slice(-10) // P0: Utiliser les 10 derniers messages au lieu de 5
      .map(msg => {
        let formatted = `[${msg.role.toUpperCase()}]: ${msg.content}`;
        // P0: Inclure les fichiers modifiés si disponibles pour contexte
        if ((msg as any).metadata?.filesAffected) {
          const files = (msg as any).metadata.filesAffected.map((f: any) => f.path || f).join(', ');
          formatted += `\n  → Fichiers modifiés: ${files}`;
        }
        return formatted;
      })
      .join('\n\n');
    
    // P0: Ajouter un résumé des modifications récentes
    const recentMods = conversationHistory
      .filter(msg => (msg as any).metadata?.filesAffected?.length > 0)
      .slice(-3);
    
    let modsSummary = '';
    if (recentMods.length > 0) {
      modsSummary = '\n\n### Recent Modifications Summary:\n' + recentMods
        .map(msg => {
          const intent = (msg as any).metadata?.intent_message || msg.content.substring(0, 50);
          const files = (msg as any).metadata?.filesAffected?.map((f: any) => f.path || f).join(', ') || 'unknown';
          return `- ${intent}: ${files}`;
        })
        .join('\n');
    }
    
    conversationSection = `\n## Recent Conversation History (last ${conversationHistory.length} messages)
Use this context to understand the user's intent, resolve references like "plus foncé", "la même chose", and maintain consistency with previous requests.

### Conversation:
${formattedHistory}
${modsSummary}\n`;
  }
  
  return `You are an expert web developer. Generate code modifications in AST JSON format.

## Detected Complexity: ${complexity.toUpperCase()}

${memorySection}
${conversationSection}

## Project Files
${filesContext}

## CRITICAL: JSON FORMATTING RULES
1. Respond with ONLY valid JSON - NO markdown code blocks (no \`\`\`json)
2. The response MUST be parseable by JSON.parse() directly
3. Keep the modifications array simple and focused
4. For simple changes, generate 1-5 modifications maximum
5. ALWAYS close all brackets [] and braces {} properly
6. NO trailing commas before ] or }
7. Ensure all strings are properly escaped

## Response Format (STRICT JSON - copy this structure exactly):
{
  "intentMessage": "Description claire de ce que vous ALLEZ faire (même langue que la demande)",
  "message": "Résumé de ce que vous AVEZ fait avec valeurs spécifiques",
  "filesAffected": [
    {"path": "styles.css", "description": "Change description", "changeType": "modified"}
  ],
  "modifications": [
    {"type": "css-change", "path": "styles.css", "target": ".selector", "property": "color", "value": "#03A5C0"}
  ]
}

## RULES FOR MESSAGES:
1. **intentMessage**: Same language as user. Be specific: "Je vais changer la couleur du bouton de #333 à #03A5C0"
2. **message**: Same language as user. Summarize with values: "J'ai modifié la couleur du bouton principal"
3. **filesAffected**: List EVERY modified file
4. NEVER use generic messages

## Modification Types

### css-change
{"type": "css-change", "path": "styles.css", "target": ".selector", "property": "color", "value": "#ff0000"}

### html-change  
{"type": "html-change", "path": "index.html", "target": "h1", "attribute": "class", "value": "new-class"}

### jsx-change
{"type": "jsx-change", "path": "App.tsx", "target": "componentName", "changes": {"prop": "newValue"}}

## Instructions for ${complexity} complexity
${complexityInstructions}

IMPORTANT: Your ENTIRE response must be valid JSON. Start with { and end with }. No text before or after.`;
}

function getComplexityInstructions(complexity: AnalysisResult['complexity']): string {
  switch (complexity) {
    case 'trivial':
      return 'Keep it simple. Generate 1-3 modifications maximum. Focus on the exact change requested. Provide a concise intentMessage and message.';
    case 'simple':
      return 'Generate 3-8 modifications. Cover the main request and immediate dependencies. Provide a clear intentMessage and detailed message.';
    case 'moderate':
      return 'Generate 8-15 modifications. Consider related files and ensure consistency. Provide a comprehensive intentMessage and message with all changes listed.';
    case 'complex':
      return 'Generate 15+ modifications if needed. Thoroughly address all aspects of the request. Provide a detailed intentMessage and message explaining all major changes.';
    default:
      return 'Generate appropriate modifications based on the request complexity.';
  }
}

// Génération avec streaming
export async function generateWithStreaming(
  apiKey: string,
  modelConfig: ModelConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (chunk: string) => void
): Promise<StreamingResult> {
  const client = new Anthropic({ apiKey });
  
  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;
  
  const stream = await client.messages.create({
    model: modelConfig.model,
    max_tokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    stream: true,
  });
  
  for await (const event of stream) {
    if (event.type === 'message_start') {
      inputTokens = event.message.usage?.input_tokens || 0;
    }
    
    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if ('text' in delta) {
        fullResponse += delta.text;
        if (onChunk) {
          onChunk(delta.text);
        }
      }
    }
    
    if (event.type === 'message_delta') {
      outputTokens = event.usage?.output_tokens || 0;
    }
  }
  
  return {
    fullResponse,
    inputTokens,
    outputTokens,
  };
}

// Fonction pour réparer le JSON tronqué ou malformé
function attemptJsonRepair(json: string): string {
  let fixed = json;
  
  // Supprimer les virgules trailing avant ] ou }
  fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
  
  // Compter les crochets et accolades
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  // Fermer les crochets manquants
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  // Fermer les accolades manquantes
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }
  
  return fixed;
}

// Parse le JSON AST depuis la réponse Claude avec support robuste
export function parseASTFromResponse(response: string): GenerationResult {
  // 1. Nettoyer les blocs markdown
  let cleanResponse = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  
  // 2. Regex tolérante pour extraire JSON avec modifications
  let jsonMatch = cleanResponse.match(/\{[\s\S]*"modifications"\s*:\s*\[[\s\S]*\]/);
  
  // 3. Si pas trouvé, essayer une regex plus permissive
  if (!jsonMatch) {
    jsonMatch = cleanResponse.match(/\{[\s\S]*"modifications"[\s\S]*/);
  }
  
  if (!jsonMatch) {
    console.error('[parseAST] No JSON found in response:', cleanResponse.substring(0, 300));
    return {
      intentMessage: 'Je vais traiter votre demande...',
      message: 'Erreur: Aucun JSON valide trouvé dans la réponse',
      modifications: [],
      filesAffected: [],
    };
  }
  
  let jsonStr = jsonMatch[0];
  
  // 4. Essayer de parser directement
  try {
    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed.modifications)) {
      console.error('[parseAST] Invalid modifications structure:', parsed);
      return {
        intentMessage: parsed.intentMessage || '',
        message: 'Erreur: Structure de modifications invalide',
        modifications: [],
        filesAffected: parsed.filesAffected || [],
      };
    }
    
    console.log('[parseAST] Successfully parsed JSON:', {
      intentMessage: parsed.intentMessage?.substring(0, 50),
      message: parsed.message?.substring(0, 50),
      modifications: parsed.modifications.length,
      filesAffected: parsed.filesAffected?.length || 0
    });
    
    return {
      intentMessage: parsed.intentMessage || '',
      message: parsed.message || 'Modifications appliquées',
      modifications: parsed.modifications,
      filesAffected: parsed.filesAffected || [],
    };
  } catch (error) {
    console.warn('[parseAST] Initial parse failed, attempting repair...', error);
    
    // 5. Tentative de réparation
    const repairedJson = attemptJsonRepair(jsonStr);
    
    try {
      const parsed = JSON.parse(repairedJson);
      
      if (Array.isArray(parsed.modifications)) {
        console.log('[parseAST] Repaired JSON successfully:', {
          modifications: parsed.modifications.length
        });
        
        return {
          intentMessage: parsed.intentMessage || '',
          message: parsed.message || 'Modifications appliquées (réparé)',
          modifications: parsed.modifications,
          filesAffected: parsed.filesAffected || [],
        };
      }
    } catch (repairError) {
      console.error('[parseAST] Repair failed:', repairError);
    }
    
    // 6. Dernier recours: extraire les modifications avec regex
    console.warn('[parseAST] Attempting regex extraction...');
    const modsMatch = cleanResponse.match(/"modifications"\s*:\s*\[([\s\S]*?)\]/);
    
    if (modsMatch) {
      try {
        const modsArray = JSON.parse(`[${modsMatch[1]}]`);
        console.log('[parseAST] Regex extracted modifications:', modsArray.length);
        
        return {
          intentMessage: 'Modifications en cours...',
          message: 'Modifications extraites avec succès',
          modifications: modsArray,
          filesAffected: [],
        };
      } catch (e) {
        console.error('[parseAST] Regex extraction failed:', e);
      }
    }
    
    console.error('[parseAST] All parsing attempts failed. Response:', cleanResponse.substring(0, 500));
    return {
      intentMessage: '',
      message: 'Erreur de parsing',
      modifications: [],
      filesAffected: [],
    };
  }
}

// Génération complète orchestrée
export async function generate(
  apiKey: string,
  complexity: AnalysisResult['complexity'],
  projectFiles: Record<string, string>,
  userPrompt: string,
  projectMemory?: string,
  onChunk?: (chunk: string) => void
): Promise<{
  result: GenerationResult;
  tokens: { input: number; output: number };
}> {
  const modelConfig = selectModel(complexity);
  const systemPrompt = buildSystemPrompt(complexity, projectFiles, projectMemory);
  
  console.log(`[generate] Using model: ${modelConfig.model} for complexity: ${complexity}`);
  
  const streamingResult = await generateWithStreaming(
    apiKey,
    modelConfig,
    systemPrompt,
    userPrompt,
    onChunk
  );
  
  const result = parseASTFromResponse(streamingResult.fullResponse);
  
  console.log(`[generate] Generated ${result.modifications.length} modifications`);
  console.log(`[generate] Intent: ${result.intentMessage}`);
  console.log(`[generate] Message: ${result.message}`);
  
  return {
    result,
    tokens: {
      input: streamingResult.inputTokens,
      output: streamingResult.outputTokens,
    },
  };
}
