import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MAX_CRM_TOKENS = 30000; // Budget max pour la génération CRM

interface ModuleSpec {
  name: string;
  module_type: string;
  icon: string;
  priority: number;
  description: string;
  widgets: WidgetSpec[];
}

interface WidgetSpec {
  widget_type: string;
  title: string;
  config: any;
  layout?: { x: number; y: number; w: number; h: number };
}

interface CRMGenerationResult {
  business_sector: string;
  sector_confidence: number;
  business_description: string;
  suggested_modules: ModuleSpec[];
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/**
 * Prompt système pour l'analyse de secteur et génération de modules CRM
 */
const SYSTEM_PROMPT = `Tu es un expert en CRM/ERP qui analyse des prompts utilisateurs pour générer des modules métier personnalisés.

Ta mission:
1. Analyser le prompt pour détecter le secteur d'activité
2. Générer entre 5 et 10 modules CRM pertinents pour ce secteur
3. Pour chaque module, créer 2-5 widgets utiles

SECTEURS POSSIBLES:
- real_estate: Agence immobilière, gestion locative
- ecommerce: Boutique en ligne, vente de produits
- restaurant: Restaurant, café, traiteur, boulangerie
- consulting: Cabinet de conseil, coaching, freelance
- construction: Entreprise BTP, artisan, architecture
- health: Cabinet médical, dentiste, physiothérapie, ostéopathe
- education: Centre de formation, école, tutoring
- legal: Cabinet d'avocat, notaire, juridique
- agency: Agence de communication, marketing, design
- saas: Startup SaaS, logiciel en ligne
- retail: Commerce de détail, boutique physique
- automotive: Garage, concessionnaire auto
- beauty: Salon de coiffure, esthétique, spa
- finance: Comptable, expert-comptable, gestion patrimoine
- events: Organisation d'événements, wedding planner
- travel: Agence de voyage, tour operator
- logistics: Transport, livraison, logistique
- other: Autre secteur

MODULES STANDARDS FRÉQUENTS (à inclure si pertinent):
- Analytiques (analytics): Tableaux de bord, statistiques, KPIs
- Contact (clients): Gestion contacts, leads, CRM
- Blog (marketing): Blog, articles, content marketing
- Facture (finance): Facturation, devis, paiements
- Finance (finance): Comptabilité, trésorerie, budget
- Marketing (marketing): Campagnes, newsletters, SEO
- Paramètres (custom): Configuration, préférences

TYPES DE MODULES DISPONIBLES:
- inventory: Gestion de stock/biens/produits
- sales: Ventes, commandes, transactions
- clients: Gestion clients, contacts, leads
- analytics: Statistiques, dashboards, KPIs
- appointments: Rendez-vous, visites, planning
- contracts: Contrats, mandats, documents
- marketing: Campagnes, newsletters, SEO
- finance: Comptabilité, facturation, trésorerie
- hr: Ressources humaines, employés
- projects: Gestion de projets, tasks
- support: Support client, tickets, SAV
- custom: Module personnalisé

TYPES DE WIDGETS DISPONIBLES:
- data-table: Tableau de données (avec colonnes configurables)
- kpi-card: Carte KPI (métrique unique)
- line-chart: Graphique en ligne
- bar-chart: Graphique en barres
- pie-chart: Graphique circulaire
- form: Formulaire de saisie
- calendar: Calendrier
- map: Carte géographique
- kanban: Tableau Kanban
- timeline: Timeline / Gantt
- stats-grid: Grille de statistiques
- list: Liste simple

CONFIGURATION DES WIDGETS:

Pour data-table:
{
  "columns": [
    {
      "key": "field_name",
      "label": "Label Affiché",
      "type": "text" | "currency" | "number" | "date" | "badge" | "boolean",
      "currency": "EUR", // si type = currency
      "unit": "m²", // si type = number
      "values": {"key": "Label"} // si type = badge
    }
  ],
  "filters": ["field1", "field2"],
  "sortable": true,
  "pagination": true,
  "actions": ["edit", "view", "delete", "duplicate"]
}

Pour kpi-card:
{
  "icon": "Home" | "DollarSign" | "Users" | "ShoppingCart" etc.,
  "color": "#03A5C0",
  "format": "number" | "currency" | "percent"
}

Pour line-chart / bar-chart / pie-chart:
{
  "xAxis": {"key": "month", "label": "Mois"},
  "yAxis": {"key": "revenue", "label": "CA", "format": "currency"},
  "color": "#03A5C0",
  "smooth": true, // pour line-chart
  "stacked": false // pour bar-chart
}

RÈGLES IMPORTANTES:
1. Génère entre 5 et 10 modules (ni plus, ni moins)
2. Chaque module doit avoir 2-5 widgets
3. Les modules standards (Analytiques, Contact, Blog, Facture, Finance, Marketing) sont fréquents MAIS ne les mets que s'ils sont pertinents
4. Sois créatif : invente des modules spécifiques au métier
5. Les widgets doivent être utiles et pratiques
6. Utilise des icônes Lucide React (ex: "Package", "Users", "Calendar", "BarChart3")
7. priority: 1-10 (10 = très important, 1 = peu important)

RÉPONDS UNIQUEMENT EN JSON VALIDE:
{
  "business_sector": "secteur_code",
  "sector_confidence": 0.0-1.0,
  "business_description": "Description courte du métier",
  "suggested_modules": [
    {
      "name": "Nom du Module",
      "module_type": "type",
      "icon": "LucideIconName",
      "priority": 1-10,
      "description": "Description du module",
      "widgets": [
        {
          "widget_type": "type",
          "title": "Titre du Widget",
          "config": {...}
        }
      ]
    }
  ]
}`;

/**
 * Appelle Claude API pour analyser le secteur et générer les modules CRM
 */
async function generateCRMModules(userPrompt: string): Promise<CRMGenerationResult> {
  console.log('[generate-crm] Analyzing prompt:', userPrompt.substring(0, 100));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: MAX_CRM_TOKENS,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyse ce prompt et génère la configuration CRM correspondante:\n\n"${userPrompt}"\n\nRéponds uniquement en JSON valide.`
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[generate-crm] Claude API error:', error);
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[generate-crm] Claude response received');

  // Extraire le contenu JSON de la réponse
  let jsonContent = data.content[0].text.trim();

  // Nettoyer les marqueurs de code si présents
  jsonContent = jsonContent.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '').trim();

  let result: CRMGenerationResult;
  try {
    const parsed = JSON.parse(jsonContent);
    result = {
      ...parsed,
      token_usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  } catch (e) {
    console.error('[generate-crm] Failed to parse JSON:', jsonContent);
    throw new Error('Failed to parse Claude response as JSON');
  }

  // Validation
  if (!result.business_sector || !result.suggested_modules || !Array.isArray(result.suggested_modules)) {
    throw new Error('Invalid CRM generation result structure');
  }

  // Vérifier que nous avons bien entre 5 et 10 modules
  if (result.suggested_modules.length < 5 || result.suggested_modules.length > 10) {
    console.warn(`[generate-crm] Expected 5-10 modules, got ${result.suggested_modules.length}`);
  }

  console.log(`[generate-crm] Generated ${result.suggested_modules.length} modules for sector: ${result.business_sector}`);

  return result;
}

/**
 * Crée les modules CRM en base de données
 */
async function createModulesInDB(
  supabase: any,
  projectId: string,
  modules: ModuleSpec[]
): Promise<void> {
  console.log(`[generate-crm] Creating ${modules.length} modules in DB for project ${projectId}`);

  for (const moduleSpec of modules) {
    // 1. Créer le module
    const { data: module, error: moduleError } = await supabase
      .from('crm_modules')
      .insert({
        project_id: projectId,
        name: moduleSpec.name,
        module_type: moduleSpec.module_type,
        icon: moduleSpec.icon,
        display_order: moduleSpec.priority,
        config: {
          description: moduleSpec.description,
          color: '#03A5C0'
        },
        is_active: true
      })
      .select()
      .single();

    if (moduleError) {
      console.error('[generate-crm] Error creating module:', moduleError);
      throw moduleError;
    }

    console.log(`[generate-crm] Created module: ${moduleSpec.name} (${module.id})`);

    // 2. Créer les widgets du module
    if (moduleSpec.widgets && moduleSpec.widgets.length > 0) {
      const widgetsToInsert = moduleSpec.widgets.map((widget, index) => {
        // Calculer le layout par défaut si non fourni
        const layout = widget.layout || calculateLayout(index, moduleSpec.widgets.length);

        return {
          module_id: module.id,
          widget_type: widget.widget_type,
          title: widget.title,
          config: widget.config,
          layout: layout,
          display_order: index,
          is_visible: true
        };
      });

      const { error: widgetsError } = await supabase
        .from('crm_widgets')
        .insert(widgetsToInsert);

      if (widgetsError) {
        console.error('[generate-crm] Error creating widgets:', widgetsError);
        throw widgetsError;
      }

      console.log(`[generate-crm] Created ${widgetsToInsert.length} widgets for module ${moduleSpec.name}`);
    }
  }
}

/**
 * Calcule le layout automatique pour un widget dans une grille 12 colonnes
 */
function calculateLayout(index: number, totalWidgets: number): { x: number; y: number; w: number; h: number } {
  // Simple layout: 2 colonnes pour la plupart des widgets
  const col = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: col * 6,  // Grid 12 colonnes, donc 6 colonnes par widget
    y: row * 4,  // Hauteur de 4 unités par widget
    w: 6,
    h: 4
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Vérifier l'authentification
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { projectId, userPrompt } = await req.json();

    if (!projectId || !userPrompt) {
      throw new Error('Missing projectId or userPrompt');
    }

    console.log(`[generate-crm] Starting CRM generation for project ${projectId}`);

    // 1. Générer les modules via Claude API
    const crmResult = await generateCRMModules(userPrompt);

    // 2. Mettre à jour le projet avec le secteur détecté
    const { error: updateError } = await supabaseClient
      .from('build_sessions')
      .update({
        business_sector: crmResult.business_sector,
        initial_modules_config: crmResult.suggested_modules
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('[generate-crm] Error updating project:', updateError);
      throw updateError;
    }

    // 3. Créer les modules et widgets en DB
    await createModulesInDB(supabaseClient, projectId, crmResult.suggested_modules);

    console.log('[generate-crm] CRM generation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        business_sector: crmResult.business_sector,
        sector_confidence: crmResult.sector_confidence,
        business_description: crmResult.business_description,
        modules_count: crmResult.suggested_modules.length,
        token_usage: crmResult.token_usage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[generate-crm] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
