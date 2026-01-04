import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MAX_CRM_TOKENS = 30000; // Budget max pour la génération CRM

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isSearchable: boolean;
  config?: any;
}

interface ObjectDefinitionSpec {
  name: string;
  singularLabel: string;
  pluralLabel: string;
  icon: string;
  color: string;
  description: string;
  fields: FieldDefinition[];
  viewConfig?: any;
  displayOrder: number;
}

interface CRMGenerationResult {
  business_sector: string;
  sector_confidence: number;
  business_description: string;
  suggested_objects: ObjectDefinitionSpec[];
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/**
 * Prompt système pour l'analyse de secteur et génération d'objets CRM flexibles
 */
const SYSTEM_PROMPT = `Tu es un expert en CRM/ERP qui analyse des prompts utilisateurs pour générer des objets métier personnalisés dans un modèle de données flexible (inspiré d'Attio).

Ta mission:
1. Analyser le prompt pour détecter le secteur d'activité
2. Générer entre 3 et 8 objets CRM pertinents pour ce secteur (équivalent des "tables" ou "entités")
3. Pour chaque objet, créer 5-15 champs (fields) utiles

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

OBJETS STANDARDS FRÉQUENTS (à inclure si pertinent):
- Contacts: Personnes, clients, leads
- Companies: Entreprises, organisations
- Deals: Opportunités, ventes, contrats
- Projects: Projets, dossiers, affaires
- Products: Produits, services, catalogue
- Invoices: Factures, devis, paiements
- Tasks: Tâches, actions, TODO
- Events: Événements, rendez-vous, visites

TYPES DE CHAMPS DISPONIBLES (16 types supportés):
- text: Texte court (nom, titre, etc.)
- email: Email avec validation
- phone: Téléphone formaté
- url: URL avec lien cliquable
- number: Nombre entier ou décimal
- currency: Montant avec devise
- date: Date simple
- datetime: Date et heure
- checkbox: Boolean true/false
- select: Liste déroulante (choix unique)
- multi_select: Liste à choix multiples
- status: Statut avec couleurs (nouveau, en cours, terminé, etc.)
- relation: Relation vers un autre objet
- user: Référence à un utilisateur
- rating: Note de 1 à 5 étoiles
- json: Données structurées JSON

CONFIGURATION DES CHAMPS:

Pour text, email, phone, url:
{
  "placeholder": "Texte par défaut",
  "maxLength": 255,
  "helpText": "Description du champ"
}

Pour number:
{
  "min": 0,
  "max": 100,
  "precision": 2,
  "unit": "kg" | "m²" | "%"
}

Pour currency:
{
  "currency": "EUR" | "USD" | "GBP",
  "precision": 2
}

Pour select, multi_select, status:
{
  "options": [
    {"id": "opt1", "label": "Option 1", "color": "#03A5C0", "icon": "🟢"},
    {"id": "opt2", "label": "Option 2", "color": "#F59E0B"}
  ],
  "placeholder": "Sélectionner..."
}

Pour relation:
{
  "targetObject": "contacts" | "companies" | "deals" etc.,
  "displayField": "name",
  "allowMultiple": false
}

RÈGLES IMPORTANTES:
1. Génère entre 3 et 8 objets (ni plus, ni moins)
2. Chaque objet doit avoir 5-15 champs pertinents
3. TOUJOURS inclure ces champs de base pour chaque objet:
   - Un champ "name" ou "title" (text, required, unique)
   - Un champ "description" ou "notes" (text)
   - Un champ de statut (status) si pertinent
4. Les objets standards (Contacts, Companies, Deals) sont fréquents MAIS ne les mets que s'ils sont pertinents
5. Sois créatif : invente des objets spécifiques au métier
6. Utilise des icônes Lucide React (ex: "Users", "Briefcase", "Package", "Calendar", "DollarSign")
7. displayOrder: 1-10 (10 = très important, 1 = peu important)
8. Utilise la couleur Magellan cyan #03A5C0 pour les objets principaux

EXEMPLES D'OBJETS PAR SECTEUR:

Immobilier (real_estate):
- Properties (Biens immobiliers): fields = [address, price, surface, rooms, type, status, photos]
- Clients: fields = [name, email, phone, budget, search_criteria]
- Visits: fields = [property, client, date, feedback, interested]

E-commerce:
- Products: fields = [name, description, price, stock, category, sku, images]
- Orders: fields = [customer, items, total, status, shipping_address, tracking]
- Customers: fields = [name, email, lifetime_value, segment]

Restaurant:
- Reservations: fields = [customer_name, date, time, guests, table, special_requests, status]
- Menu_Items: fields = [name, description, price, category, allergens, available]
- Tables: fields = [number, capacity, location, status]

RÉPONDS UNIQUEMENT EN JSON VALIDE:
{
  "business_sector": "secteur_code",
  "sector_confidence": 0.0-1.0,
  "business_description": "Description courte du métier",
  "suggested_objects": [
    {
      "name": "contacts",
      "singularLabel": "Contact",
      "pluralLabel": "Contacts",
      "icon": "Users",
      "color": "#03A5C0",
      "description": "Gestion des contacts clients",
      "displayOrder": 10,
      "viewConfig": {
        "default": "table",
        "available": ["table", "kanban"]
      },
      "fields": [
        {
          "id": "fld_name",
          "name": "name",
          "label": "Nom complet",
          "type": "text",
          "isRequired": true,
          "isUnique": false,
          "isSearchable": true,
          "config": {
            "placeholder": "Jean Dupont",
            "maxLength": 100
          }
        },
        {
          "id": "fld_email",
          "name": "email",
          "label": "Email",
          "type": "email",
          "isRequired": true,
          "isUnique": true,
          "isSearchable": true
        },
        {
          "id": "fld_status",
          "name": "status",
          "label": "Statut",
          "type": "status",
          "isRequired": true,
          "isUnique": false,
          "isSearchable": false,
          "config": {
            "options": [
              {"id": "lead", "label": "Lead", "color": "#F59E0B"},
              {"id": "client", "label": "Client", "color": "#10B981"},
              {"id": "inactive", "label": "Inactif", "color": "#6B7280"}
            ]
          }
        }
      ]
    }
  ]
}`;

/**
 * Appelle Claude API pour analyser le secteur et générer les objets CRM
 */
async function generateCRMObjects(userPrompt: string): Promise<CRMGenerationResult> {
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
  if (!result.business_sector || !result.suggested_objects || !Array.isArray(result.suggested_objects)) {
    throw new Error('Invalid CRM generation result structure');
  }

  // Vérifier que nous avons bien entre 3 et 8 objets
  if (result.suggested_objects.length < 3 || result.suggested_objects.length > 8) {
    console.warn(`[generate-crm] Expected 3-8 objects, got ${result.suggested_objects.length}`);
  }

  console.log(`[generate-crm] Generated ${result.suggested_objects.length} objects for sector: ${result.business_sector}`);

  return result;
}

/**
 * Crée les object_definitions en base de données
 */
async function createObjectDefinitionsInDB(
  supabase: any,
  projectId: string,
  objects: ObjectDefinitionSpec[]
): Promise<void> {
  console.log(`[generate-crm] Creating ${objects.length} object definitions in DB for project ${projectId}`);

  for (const objectSpec of objects) {
    // Créer l'object_definition
    const { data: objectDef, error: objectError } = await supabase
      .from('object_definitions')
      .insert({
        project_id: projectId,
        name: objectSpec.name,
        singular_label: objectSpec.singularLabel,
        plural_label: objectSpec.pluralLabel,
        icon: objectSpec.icon,
        color: objectSpec.color || '#03A5C0',
        description: objectSpec.description,
        fields: objectSpec.fields,
        view_config: objectSpec.viewConfig || {
          default: 'table',
          available: ['table', 'kanban', 'timeline']
        },
        settings: {},
        is_system: false,
        generated_by_ai: true,
        display_order: objectSpec.displayOrder || 0
      })
      .select()
      .single();

    if (objectError) {
      console.error('[generate-crm] Error creating object definition:', objectError);
      throw objectError;
    }

    console.log(`[generate-crm] Created object definition: ${objectSpec.name} (${objectDef.id})`);
    console.log(`[generate-crm]   → ${objectSpec.fields.length} fields defined`);
  }
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

    // 1. Générer les objets via Claude API
    const crmResult = await generateCRMObjects(userPrompt);

    // 2. Mettre à jour le projet avec le secteur détecté
    const { error: updateError } = await supabaseClient
      .from('build_sessions')
      .update({
        business_sector: crmResult.business_sector,
        initial_modules_config: crmResult.suggested_objects
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('[generate-crm] Error updating project:', updateError);
      throw updateError;
    }

    // 3. Créer les object_definitions en DB
    await createObjectDefinitionsInDB(supabaseClient, projectId, crmResult.suggested_objects);

    console.log('[generate-crm] CRM generation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        business_sector: crmResult.business_sector,
        sector_confidence: crmResult.sector_confidence,
        business_description: crmResult.business_description,
        objects_count: crmResult.suggested_objects.length,
        token_usage: crmResult.token_usage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[generate-crm] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
