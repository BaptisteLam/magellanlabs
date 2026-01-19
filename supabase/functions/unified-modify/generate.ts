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
  
  // P0: Ajouter l'historique de conversation au contexte
  let conversationSection = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const formattedHistory = conversationHistory
      .slice(-5) // Limiter aux 5 derniers messages
      .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n');
    conversationSection = `\n## Recent Conversation History\nUse this context to understand the user's intent and maintain consistency with previous requests:\n${formattedHistory}\n`;
  }
  
  return `You are an expert web developer. You must generate code modifications in AST JSON format with contextual messages.

## Detected Complexity: ${complexity.toUpperCase()}

${memorySection}
${conversationSection}

## Project Files
${filesContext}

## Response Format
You must respond with ONLY valid JSON (no markdown code blocks). The format is:
{
  "intentMessage": "A clear, user-friendly message in the same language as the user request describing what you WILL do (e.g., 'Je vais modifier la couleur du bouton principal en bleu et ajuster le padding')",
  "message": "A clear, user-friendly conclusion message in the same language as the user request describing what you DID and the key changes made (e.g., 'J'ai changé la couleur du bouton de #333 à #03A5C0 et augmenté le padding de 10px à 16px pour une meilleure lisibilité.')",
  "filesAffected": [
    {
      "path": "styles.css",
      "description": "Couleur du bouton modifiée de #333 à #03A5C0",
      "changeType": "modified"
    }
  ],
  "modifications": [
    // Array of AST modifications
  ]
}

## CRITICAL RULES FOR MESSAGES:
1. **intentMessage**: Write in the SAME LANGUAGE as the user's request. Be specific about WHAT you will change and WHERE.
2. **message**: Write in the SAME LANGUAGE as the user's request. Summarize the ACTUAL changes made with specific values (colors, sizes, etc.)
3. **filesAffected**: List EVERY file you modified with a clear description of the change
4. Never use generic messages like "Modifications applied" or "Changes made"
5. Always mention specific values, properties, or elements that were changed

## Modification Types

### css-change
For CSS property modifications:
{
  "type": "css-change",
  "path": "styles.css",
  "target": ".selector",
  "property": "color",
  "value": "#ff0000"
}

### html-change
For HTML attribute modifications:
{
  "type": "html-change",
  "path": "index.html",
  "target": "h1",
  "attribute": "class",
  "value": "new-class"
}

### jsx-change
For JSX/JavaScript modifications:
{
  "type": "jsx-change",
  "path": "App.tsx",
  "target": "componentName",
  "changes": {
    "prop": "newValue"
  }
}

## Instructions for ${complexity} complexity
${complexityInstructions}

IMPORTANT: Respond with ONLY valid JSON. No markdown, no code blocks, just raw JSON.`;
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

// Parse le JSON AST depuis la réponse Claude avec support des nouveaux champs
export function parseASTFromResponse(response: string): GenerationResult {
  // Regex tolérante pour extraire JSON avec ou sans markdown
  const jsonMatch = response.match(/\{[\s\S]*"modifications"[\s\S]*\}/);
  
  if (!jsonMatch) {
    console.error('No JSON found in response:', response.substring(0, 200));
    return {
      intentMessage: '',
      message: 'Error: No valid JSON found in response',
      modifications: [],
      filesAffected: [],
    };
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed.modifications)) {
      console.error('Invalid modifications structure:', parsed);
      return {
        intentMessage: '',
        message: 'Error: Invalid modifications structure',
        modifications: [],
        filesAffected: [],
      };
    }
    
    return {
      intentMessage: parsed.intentMessage || '',
      message: parsed.message || 'Modifications generated',
      modifications: parsed.modifications,
      filesAffected: parsed.filesAffected || [],
    };
  } catch (error) {
    console.error('JSON parse error:', error, 'Response:', response.substring(0, 500));
    return {
      intentMessage: '',
      message: 'Parse error',
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
