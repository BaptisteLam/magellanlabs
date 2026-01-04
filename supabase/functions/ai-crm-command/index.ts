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

    // Analyser l'intent (version simple pour l'instant)
    const intent = analyzeIntent(prompt, context);

    console.log('🎯 Detected intent:', intent.type);

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
 * Analyse l'intent du prompt (version simple basée sur des mots-clés)
 * TODO: Utiliser Claude API pour une analyse plus sophistiquée
 */
function analyzeIntent(prompt: string, context?: CommandRequest['context']): Intent {
  const lowerPrompt = prompt.toLowerCase();

  // Patterns de détection d'intent
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
        confidence: 0.8,
        params: extractParams(prompt, pattern.type, context),
      };
    }
  }

  return {
    type: 'unknown',
    confidence: 0,
    params: {},
  };
}

/**
 * Extrait les paramètres du prompt selon l'intent
 */
function extractParams(prompt: string, intentType: IntentType, context?: CommandRequest['context']): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (context?.currentObjectType) {
    params.objectType = context.currentObjectType;
  }

  if (context?.selectedElement) {
    params.selectedElement = context.selectedElement;
  }

  // TODO: Extraction plus sophistiquée avec Claude API

  return params;
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
