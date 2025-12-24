// Edge Function: generate-widget
// Description: Génère du code React pour un widget personnalisé via Claude Sonnet 4.5

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SYSTEM_PROMPT = `Tu es un expert React/TypeScript spécialisé dans la génération de composants pour le CRM Magellan.

CONTEXTE TECHNIQUE:
- Stack: React 18, TypeScript, Tailwind CSS, shadcn/ui
- Charts: Recharts (LineChart, BarChart, PieChart, AreaChart, etc.)
- Icons: Lucide React (disponible via la variable "Icons")
- Design System: Magellan cyan #03A5C0 comme couleur primaire

VARIABLES DISPONIBLES DANS LE CONTEXTE:
- React, useState, useEffect, useMemo, useCallback, useRef
- Recharts: LineChart, BarChart, PieChart, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Bar, Pie, Area, Cell, ResponsiveContainer
- UI: Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger, Progress, Skeleton
- Icons: tous les icônes Lucide (Icons.Home, Icons.Users, Icons.DollarSign, etc.)
- Utilitaires: formatCurrency(value, currency), formatDate(date), formatNumber(value), formatPercent(value)

DONNÉES ACCESSIBLES VIA PROPS:
- config: configuration du widget
- widgetId: identifiant unique du widget
- dataSources: sources de données externes

RÈGLES STRICTES:
1. Génère UNIQUEMENT du JavaScript pur (PAS de JSX, utilise React.createElement)
2. Le code doit définir une fonction "GeneratedWidget" qui prend {config, widgetId, dataSources}
3. N'importe RIEN - toutes les dépendances sont déjà dans le contexte
4. Gestion d'erreurs complète avec try/catch
5. Loading states avec Skeleton
6. Responsive design
7. Couleur primaire: #03A5C0

STRUCTURE ATTENDUE:
function GeneratedWidget({ config, widgetId, dataSources }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Données statiques pour la démo (remplacer par dataSources en prod)
  const demoData = [
    { name: 'Jan', value: 4000 },
    { name: 'Fév', value: 3000 },
    { name: 'Mar', value: 5000 },
  ];

  return React.createElement(Card, { className: 'h-full' },
    React.createElement(CardHeader, null,
      React.createElement(CardTitle, null, 'Mon Widget')
    ),
    React.createElement(CardContent, null,
      React.createElement(ResponsiveContainer, { width: '100%', height: 300 },
        React.createElement(LineChart, { data: demoData },
          React.createElement(XAxis, { dataKey: 'name' }),
          React.createElement(YAxis, null),
          React.createElement(Tooltip, null),
          React.createElement(Line, { type: 'monotone', dataKey: 'value', stroke: '#03A5C0' })
        )
      )
    )
  );
}

EXEMPLES React.createElement:
- Div: React.createElement('div', { className: 'p-4' }, 'Hello')
- Card: React.createElement(Card, { className: 'p-6' }, children)
- Icon: React.createElement(Icons.Home, { className: 'w-6 h-6' })
- Multiple children: React.createElement('div', null, child1, child2, child3)

Génère du code JavaScript pur et fonctionnel.`;

interface GenerateWidgetRequest {
  projectId: string;
  moduleId: string;
  userPrompt: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  existingWidgetId?: string; // Pour modification d'un widget existant
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { projectId, moduleId, userPrompt, conversationHistory = [], existingWidgetId } =
      await req.json() as GenerateWidgetRequest;

    // Validation
    if (!projectId || !moduleId || !userPrompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: projectId, moduleId, userPrompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Vérifier que le projet appartient à l'utilisateur
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: project } = await supabase
      .from('build_sessions')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (!project || project.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[generate-widget] Generating widget for project ${projectId}, module ${moduleId}`);
    console.log(`[generate-widget] User prompt: ${userPrompt}`);

    // Si c'est une modification, récupérer le code existant
    let existingCode = '';
    if (existingWidgetId) {
      const { data: existingWidget } = await supabase
        .from('crm_widgets')
        .select('generated_code, title')
        .eq('id', existingWidgetId)
        .single();

      if (existingWidget) {
        existingCode = existingWidget.generated_code || '';
      }
    }

    // Construire le prompt pour Claude
    let claudePrompt = userPrompt;
    if (existingCode) {
      claudePrompt = `MODIFICATION D'UN WIDGET EXISTANT:

CODE ACTUEL:
\`\`\`javascript
${existingCode}
\`\`\`

DEMANDE DE MODIFICATION:
${userPrompt}

Génère le code complet du widget modifié en JavaScript pur (React.createElement).`;
    }

    // Appeler Claude Sonnet 4.5
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 30000,
        system: SYSTEM_PROMPT,
        messages: [
          ...conversationHistory,
          {
            role: 'user',
            content: claudePrompt,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text();
      console.error('[generate-widget] Anthropic API error:', error);
      throw new Error(`Anthropic API error: ${error}`);
    }

    const anthropicData = await anthropicResponse.json();
    const generatedText = anthropicData.content[0].text;

    // Extraire le code JavaScript du code fence si présent
    const codeMatch = generatedText.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
    const generatedCode = codeMatch ? codeMatch[1].trim() : generatedText.trim();

    // Validation basique du code
    if (!generatedCode.includes('GeneratedWidget')) {
      throw new Error('Generated code does not contain a GeneratedWidget function');
    }

    // Détection automatique du titre du widget
    const titleMatch = userPrompt.match(/(graphique|tableau|kpi|calendrier|liste|carte|dashboard)/i);
    const widgetType = titleMatch ? titleMatch[1].toLowerCase() : 'widget';
    const defaultTitle = `${widgetType.charAt(0).toUpperCase() + widgetType.slice(1)} personnalisé`;

    // Créer ou mettre à jour le widget dans la DB
    if (existingWidgetId) {
      // Incrémenter la version du code via RPC
      const { data: newVersion } = await supabase.rpc('increment_code_version', { widget_uuid: existingWidgetId });
      
      // Mise à jour du widget
      const { data: updatedWidget, error: updateError } = await supabase
        .from('crm_widgets')
        .update({
          generated_code: generatedCode,
          generation_prompt: userPrompt,
          generation_timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWidgetId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update widget: ${updateError.message}`);
      }

      console.log(`[generate-widget] Widget ${existingWidgetId} updated successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          widget_id: existingWidgetId,
          widget_title: updatedWidget.title,
          action: 'updated',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } else {
      // Nouvelle création - utiliser 'dynamic' pour les widgets générés par IA
      const { data: newWidget, error: insertError } = await supabase
        .from('crm_widgets')
        .insert({
          module_id: moduleId,
          widget_type: 'dynamic',
          title: defaultTitle,
          generated_code: generatedCode,
          is_code_generated: true,
          generation_prompt: userPrompt,
          generation_timestamp: new Date().toISOString(),
          code_version: 1,
          config: {},
          layout: { x: 0, y: 0, w: 12, h: 6 }, // Grille 12 colonnes, hauteur 6
          is_visible: true,
          display_order: 999, // À la fin par défaut
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create widget: ${insertError.message}`);
      }

      console.log(`[generate-widget] Widget ${newWidget.id} created successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          widget_id: newWidget.id,
          widget_title: defaultTitle,
          action: 'created',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('[generate-widget] Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
