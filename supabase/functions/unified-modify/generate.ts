/**
 * PHASE 3: GÉNÉRATION ADAPTATIVE
 * - Model Selection (Haiku/Sonnet)
 * - AST Generation
 * - Streaming SSE
 * - Token Optimization
 */

export interface GenerationConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export function selectModel(complexity: 'trivial' | 'simple' | 'moderate' | 'complex'): GenerationConfig {
  if (complexity === 'trivial') {
    return {
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 2000,
      temperature: 0.2
    };
  } else if (complexity === 'simple') {
    return {
      model: 'claude-sonnet-4-5',
      maxTokens: 3000,
      temperature: 0.3
    };
  } else if (complexity === 'moderate') {
    return {
      model: 'claude-sonnet-4-5',
      maxTokens: 4000,
      temperature: 0.3
    };
  } else {
    return {
      model: 'claude-sonnet-4-5',
      maxTokens: 5000,
      temperature: 0.3
    };
  }
}

export function buildSystemPrompt(
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex',
  memoryContext: string
): string {
  const memoryPrefix = memoryContext ? `# CONTEXT FROM MEMORY\n${memoryContext}\n\n` : '';

  const basePrompt = `${memoryPrefix}Tu es un assistant de modification de code ultra-rapide et précis utilisant l'AST (Abstract Syntax Tree).

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
Ce message sera affiché à l'utilisateur AVANT l'exécution des modifications.

Exemples de bons messages:
- "Je vais changer la couleur du titre en bleu"
- "Je vais ajouter un bouton de contact dans le header"
- "Je vais modifier la taille de la police du paragraphe"

❌ INTERDIT: Messages génériques comme "Je vais modifier le code"
✅ OBLIGATOIRE: Message spécifique décrivant exactement ce qui sera modifié

TYPES DE MODIFICATIONS AST:
- update: Modifier une propriété/attribut/valeur existante
- insert: Insérer un nouvel élément/propriété
- delete: Supprimer un élément/propriété
- replace: Remplacer un élément entier

FILE TYPES:
- "css": Pour fichiers CSS
- "html": Pour fichiers HTML
- "js": Pour fichiers JavaScript
- "jsx": Pour fichiers React JSX

EXEMPLES:

CSS (modifier couleur):
{
  "path": "styles.css",
  "fileType": "css",
  "type": "update",
  "target": { "selector": "h1", "property": "color" },
  "value": "blue"
}

HTML (changer texte):
{
  "path": "index.html",
  "fileType": "html",
  "type": "update",
  "target": { "selector": "h1" },
  "value": "Nouveau titre"
}

JS (modifier variable):
{
  "path": "script.js",
  "fileType": "js",
  "type": "update",
  "target": { "identifier": "menuOpen" },
  "value": "false"
}

RÈGLES ABSOLUES:
1. TOUJOURS retourner du JSON valide avec un champ "message" descriptif
2. Le tableau 'modifications' NE DOIT JAMAIS être vide
3. Utilise la structure AST appropriée pour le type de fichier
4. SOIS PRÉCIS: identifie exactement l'élément cible
5. SOIS CONCIS: modifie uniquement ce qui est demandé`;

  if (complexity === 'trivial') {
    return basePrompt + '\n\nMODE ULTRA-RAPIDE: Génère 1 modification ciblée minimum. JSON AST obligatoire.';
  } else if (complexity === 'simple') {
    return basePrompt + '\n\nMODE RAPIDE: Génère 1-3 modifications simples. JSON AST obligatoire.';
  } else {
    return basePrompt + '\n\nMODE STANDARD: Modifications multiples possibles. JSON AST obligatoire.';
  }
}

export async function generateWithStreaming(
  apiKey: string,
  model: string,
  maxTokens: number,
  temperature: number,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: any) => void
): Promise<{ fullResponse: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No stream reader');

  const decoder = new TextDecoder();
  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
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
            onChunk({ type: 'text_delta', text: delta });
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
    throw error;
  }

  return { fullResponse, inputTokens, outputTokens };
}

export function parseASTFromResponse(response: string): {
  modifications: any[];
  message: string;
  error: string | null;
} {
  try {
    const jsonMatch = response.match(/\{[\s\S]*?"modifications"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        modifications: parsed.modifications || [],
        message: parsed.message || 'Modifications appliquées',
        error: null
      };
    }

    return {
      modifications: [],
      message: '',
      error: 'Aucun JSON AST valide trouvé dans la réponse'
    };
  } catch (err) {
    return {
      modifications: [],
      message: '',
      error: err instanceof Error ? err.message : 'Erreur parsing JSON AST'
    };
  }
}
