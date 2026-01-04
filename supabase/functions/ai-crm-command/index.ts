/**
 * Edge Function pour analyser les commandes IA du CRM
 * Analyse l'intent de l'utilisateur et exécute les actions appropriées
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MAX_COMMAND_TOKENS = 2000;

interface CommandRequest {
  projectId: string;
  prompt: string;
  context?: {
    currentObjectType?: string;
    selectedElement?: {
      type: string;
      id: string;
      label: string;
    };
  };
}

type IntentType =
  | 'create_object_definition'
  | 'create_record'
  | 'update_record'
  | 'create_field'
  | 'create_view'
  | 'filter_data'
  | 'modify_element'
  | 'unknown';

interface Intent {
  type: IntentType;
  confidence: number;
  params: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { projectId, prompt, context }: CommandRequest = await req.json();

    if (!projectId || !prompt) {
      return new Response(JSON.stringify({ error: 'projectId and prompt required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🤖 Analyzing command:', prompt);
    console.log('📍 Context:', context);

    // Analyser l'intent avec Claude API
    const intent = await analyzeIntent(prompt, context);

    console.log('🎯 Detected intent:', intent.type, `(confidence: ${intent.confidence})`);

    // Exécuter l'action selon l'intent
    const result = await executeIntent(intent, projectId, supabase);

    return new Response(JSON.stringify({
      success: true,
      intent: intent.type,
      result,
      message: generateResponseMessage(intent, result),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ AI command error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Analyse l'intent du prompt avec Claude API
 */
async function analyzeIntent(prompt: string, context?: CommandRequest['context']): Promise<Intent> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️ ANTHROPIC_API_KEY not set, using fallback keyword matching');
    return fallbackIntentAnalysis(prompt, context);
  }

  try {
    const systemPrompt = `Tu es un assistant IA pour un CRM bac à sable. Analyse l'intent de l'utilisateur et retourne un JSON structuré.

INTENTS DISPONIBLES:
- create_object_definition: Créer un nouveau type d'objet (ex: "Contacts", "Deals")
- create_record: Créer un nouvel enregistrement dans un objet existant
- update_record: Modifier un enregistrement existant
- create_field: Ajouter un nouveau champ à un objet
- create_view: Créer ou modifier une vue
- filter_data: Filtrer ou rechercher des données
- modify_element: Modifier un élément UI sélectionné
- unknown: Intent non reconnu

CONTEXTE ACTUEL:
${context ? JSON.stringify(context, null, 2) : 'Aucun contexte'}

RÉPONDS UNIQUEMENT EN JSON VALIDE:
{
  "type": "intent_type",
  "confidence": 0.0-1.0,
  "params": {
    "key": "value"
  }
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: MAX_COMMAND_TOKENS,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyse cette commande: "${prompt}"\n\nRéponds uniquement en JSON.`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('❌ Claude API error:', await response.text());
      return fallbackIntentAnalysis(prompt, context);
    }

    const data = await response.json();
    let jsonContent = data.content[0].text.trim();
    jsonContent = jsonContent.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '').trim();

    const intent = JSON.parse(jsonContent);
    console.log('✅ Claude analyzed intent:', intent);

    return intent;
  } catch (error) {
    console.error('❌ Error calling Claude API:', error);
    return fallbackIntentAnalysis(prompt, context);
  }
}

/**
 * Fallback: analyse simple par mots-clés si Claude API échoue
 */
function fallbackIntentAnalysis(prompt: string, context?: CommandRequest['context']): Intent {
  const lowerPrompt = prompt.toLowerCase();

  const patterns: Array<{ type: IntentType; keywords: string[]; contextRequired?: string }> = [
    { type: 'create_object_definition', keywords: ['nouvel objet', 'créer un objet', 'ajouter un objet'] },
    { type: 'create_record', keywords: ['nouveau', 'créer', 'ajouter un'], contextRequired: 'objectType' },
    { type: 'update_record', keywords: ['modifier', 'changer', 'mettre à jour'], contextRequired: 'selectedElement' },
    { type: 'create_field', keywords: ['ajouter un champ', 'nouveau champ', 'créer un champ'] },
    { type: 'create_view', keywords: ['nouvelle vue', 'créer une vue', 'ajouter une vue'] },
    { type: 'filter_data', keywords: ['filtrer', 'afficher les', 'montrer les'] },
    { type: 'modify_element', keywords: ['modifie', 'change'], contextRequired: 'selectedElement' },
  ];

  for (const pattern of patterns) {
    const hasKeywords = pattern.keywords.some(kw => lowerPrompt.includes(kw));
    const hasContext = !pattern.contextRequired ||
      (pattern.contextRequired === 'objectType' && context?.currentObjectType) ||
      (pattern.contextRequired === 'selectedElement' && context?.selectedElement);

    if (hasKeywords && hasContext) {
      return {
        type: pattern.type,
        confidence: 0.6,
        params: {
          objectType: context?.currentObjectType,
          selectedElement: context?.selectedElement,
        },
      };
    }
  }

  return { type: 'unknown', confidence: 0, params: {} };
}

/**
 * Exécute l'action selon l'intent
 */
async function executeIntent(intent: Intent, projectId: string, supabase: any): Promise<any> {
  switch (intent.type) {
    case 'create_object_definition':
      // TODO: Créer une nouvelle object_definition
      return { action: 'create_object_definition', status: 'pending' };

    case 'create_record':
      // TODO: Créer un nouveau record
      return { action: 'create_record', status: 'pending' };

    case 'update_record':
      // TODO: Mettre à jour un record
      return { action: 'update_record', status: 'pending' };

    case 'create_field':
      // TODO: Ajouter un champ à un objet
      return { action: 'create_field', status: 'pending' };

    case 'create_view':
      // TODO: Créer une nouvelle vue
      return { action: 'create_view', status: 'pending' };

    case 'filter_data':
      // TODO: Appliquer des filtres
      return { action: 'filter_data', status: 'pending' };

    case 'modify_element':
      // TODO: Modifier un élément sélectionné
      return { action: 'modify_element', status: 'pending' };

    default:
      return { action: 'unknown', status: 'error', message: 'Intent non reconnu' };
  }
}

/**
 * Génère un message de réponse selon l'intent et le résultat
 */
function generateResponseMessage(intent: Intent, result: any): string {
  const messages: Record<IntentType, string> = {
    create_object_definition: 'Je vais créer un nouvel objet pour vous.',
    create_record: 'Je vais créer ce nouvel enregistrement.',
    update_record: 'Je vais modifier cet enregistrement.',
    create_field: 'Je vais ajouter ce champ.',
    create_view: 'Je vais créer cette vue.',
    filter_data: 'Je vais filtrer les données.',
    modify_element: 'Je vais modifier cet élément.',
    unknown: 'Je n\'ai pas compris votre demande. Pouvez-vous reformuler ?',
  };

  return messages[intent.type] || messages.unknown;
}
