import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * chat-only Edge Function — Powered by VibeSDK
 *
 * Routes chat messages through VibeSDK's follow-up API when an active
 * agent session exists. Falls back to a local structured response when
 * no agent is available.
 *
 * POST /chat-only
 * Body: { message, chatHistory?, sessionId? }
 * Returns: { response, thoughtDuration, tokens }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, chatHistory, sessionId } = await req.json();
    const startTime = Date.now();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const VIBESDK_API_KEY = Deno.env.get('VIBESDK_API_KEY');
    const VIBESDK_BASE_URL = Deno.env.get('VIBESDK_BASE_URL') || 'https://build.cloudflare.dev';

    // Try to find an existing VibeSDK agent for this session
    let agentId: string | null = null;
    if (sessionId) {
      const { data: sessionData } = await supabase
        .from('build_sessions')
        .select('vibesdk_session_id')
        .eq('id', sessionId)
        .maybeSingle();

      agentId = sessionData?.vibesdk_session_id || null;
    }

    console.log(`[chat-only] User ${user.id} | Session ${sessionId} | AgentId: ${agentId} | Message: ${message.substring(0, 100)}...`);

    let responseText = '';

    // Strategy 1: Use VibeSDK follow-up if we have an active agent
    if (VIBESDK_API_KEY && agentId) {
      try {
        console.log('[chat-only] Routing through VibeSDK follow-up API');

        const vibeResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent/${agentId}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VIBESDK_API_KEY}`,
          },
          body: JSON.stringify({
            message: message,
            type: 'user_suggestion',
          }),
        });

        if (vibeResponse.ok) {
          const vibeData = await vibeResponse.json();
          // VibeSDK may return response in different formats
          responseText = vibeData.message
            || vibeData.response
            || vibeData.text
            || vibeData.content
            || '';

          // If VibeSDK returned something useful, use it
          if (responseText && responseText.length > 20) {
            console.log('[chat-only] VibeSDK response received:', responseText.substring(0, 100));
          } else {
            // If response is too short or empty, try to get status for more context
            const statusResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent/${agentId}/status`, {
              headers: { 'Authorization': `Bearer ${VIBESDK_API_KEY}` },
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.lastMessage || statusData.status) {
                responseText = statusData.lastMessage || `Le projet est en statut: ${statusData.status}. Votre message a été envoyé à l'agent VibeSDK.`;
              }
            }

            // If still nothing useful, generate a local plan
            if (!responseText || responseText.length < 20) {
              responseText = generateLocalPlan(message, chatHistory);
            }
          }
        } else {
          console.warn('[chat-only] VibeSDK follow-up failed:', vibeResponse.status);
          responseText = generateLocalPlan(message, chatHistory);
        }
      } catch (vibeError) {
        console.warn('[chat-only] VibeSDK error:', vibeError);
        responseText = generateLocalPlan(message, chatHistory);
      }
    }
    // Strategy 2: Use VibeSDK to create a new agent for the chat
    else if (VIBESDK_API_KEY && !agentId) {
      try {
        console.log('[chat-only] Creating new VibeSDK agent for chat');

        const vibeResponse = await fetch(`${VIBESDK_BASE_URL}/api/agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VIBESDK_API_KEY}`,
          },
          body: JSON.stringify({
            query: `Respond to this user question as a web development planning assistant. Give a structured plan with analysis, action steps, and recommendations. Question: ${message}`,
            projectType: 'app',
            behaviorType: 'phasic',
          }),
        });

        if (vibeResponse.ok) {
          const vibeData = await vibeResponse.json();
          const newAgentId = vibeData.agentId || vibeData.id;

          // Store the new agentId in the session for future follow-ups
          if (sessionId && newAgentId) {
            await supabase
              .from('build_sessions')
              .update({ vibesdk_session_id: newAgentId })
              .eq('id', sessionId);
          }

          responseText = vibeData.message || vibeData.response || vibeData.text || '';

          if (!responseText || responseText.length < 20) {
            responseText = generateLocalPlan(message, chatHistory);
          }
        } else {
          console.warn('[chat-only] VibeSDK agent creation failed:', vibeResponse.status);
          responseText = generateLocalPlan(message, chatHistory);
        }
      } catch (vibeError) {
        console.warn('[chat-only] VibeSDK error:', vibeError);
        responseText = generateLocalPlan(message, chatHistory);
      }
    }
    // Strategy 3: No VibeSDK key — local response
    else {
      console.log('[chat-only] No VIBESDK_API_KEY, using local planning');
      responseText = generateLocalPlan(message, chatHistory);
    }

    const thoughtDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        response: responseText,
        thoughtDuration,
        tokens: {
          input: 0,
          output: 0,
          total: 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in chat-only function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Generates a structured local plan when VibeSDK is unavailable.
 * Analyzes the user's message and produces a formatted markdown response
 * with analysis, action plan, and recommendations.
 */
function generateLocalPlan(message: string, chatHistory?: Array<{ role: string; content: string }>): string {
  const lower = message.toLowerCase();

  // Detect intent categories
  const isAddFeature = /ajout|add|créer|create|nouveau|new|intégr|implement/i.test(lower);
  const isModify = /chang|modifi|update|amélio|improv|optimis/i.test(lower);
  const isFix = /corrig|fix|bug|erreur|error|problème|issue/i.test(lower);
  const isStyle = /design|style|couleur|color|police|font|layout|responsive|animation|css/i.test(lower);
  const isPerformance = /performance|vitesse|speed|optimi|cache|lazy/i.test(lower);
  const isAuth = /auth|login|connexion|inscription|register|password|mot de passe/i.test(lower);
  const isDatabase = /base de données|database|api|backend|serveur|server|fetch|requête/i.test(lower);

  // Build contextual analysis
  let analysis = '';
  let steps: string[] = [];
  let recommendations: string[] = [];

  if (isAuth) {
    analysis = "Vous souhaitez mettre en place un système d'authentification. C'est un élément critique qui nécessite une attention particulière à la sécurité.";
    steps = [
      "**Créer la page de connexion** dans `login.html`\n   - Formulaire avec email et mot de passe\n   - Validation côté client\n   - Lien vers l'inscription",
      "**Créer la page d'inscription** dans `register.html`\n   - Champs: nom, email, mot de passe, confirmation\n   - Validation des champs en temps réel",
      "**Implémenter la logique d'authentification** dans `auth.js`\n   - Gestion des tokens JWT\n   - Stockage sécurisé (HttpOnly cookies)\n   - Middleware de protection des routes",
      "**Styliser les formulaires** dans `styles.css`\n   - Design moderne et responsive\n   - États de validation visuels\n   - Messages d'erreur élégants",
    ];
    recommendations = [
      "Utilisez HTTPS pour toutes les communications",
      "Hashez les mots de passe côté serveur (bcrypt)",
      "Implémentez une protection contre les attaques par force brute",
    ];
  } else if (isDatabase) {
    analysis = "Vous souhaitez intégrer une couche données/API. Cela nécessite une architecture backend solide.";
    steps = [
      "**Définir le schéma de données**\n   - Identifier les entités et relations\n   - Créer les tables/collections nécessaires",
      "**Créer les endpoints API**\n   - Routes CRUD pour chaque entité\n   - Validation des entrées\n   - Gestion des erreurs",
      "**Implémenter le service client** dans `api.js`\n   - Fonctions fetch avec gestion d'erreurs\n   - Cache côté client pour les requêtes fréquentes",
      "**Connecter l'interface utilisateur**\n   - Afficher les données dynamiquement\n   - Gestion des états de chargement\n   - Optimistic updates pour UX fluide",
    ];
    recommendations = [
      "Utilisez Supabase ou une API REST structurée",
      "Implémentez une pagination pour les listes longues",
      "Ajoutez une gestion d'erreurs robuste côté client",
    ];
  } else if (isStyle) {
    analysis = "Vous souhaitez améliorer l'aspect visuel de votre site. Le design est crucial pour l'expérience utilisateur.";
    steps = [
      "**Définir la palette de couleurs** dans les variables CSS `:root`\n   - Couleur primaire, secondaire, accent\n   - Tons clairs et foncés\n   - Couleurs de texte et fond",
      "**Améliorer la typographie**\n   - Hiérarchie des titres (h1-h6)\n   - Taille et espacement de lecture\n   - Police de caractères cohérente",
      "**Optimiser le layout responsive**\n   - Breakpoints mobiles (768px, 1024px, 1200px)\n   - Grid et Flexbox pour les dispositions\n   - Images adaptatives",
      "**Ajouter des animations subtiles**\n   - Transitions hover sur les boutons et cartes\n   - Animations d'apparition au scroll\n   - Micro-interactions pour le feedback",
    ];
    recommendations = [
      "Testez sur mobile d'abord (mobile-first approach)",
      "Limitez les animations à 300ms pour rester fluide",
      "Utilisez des variables CSS pour un thème cohérent",
    ];
  } else if (isPerformance) {
    analysis = "Vous souhaitez optimiser les performances de votre site. La vitesse est un facteur clé pour le SEO et l'expérience utilisateur.";
    steps = [
      "**Optimiser les images**\n   - Compression WebP/AVIF\n   - Lazy loading (`loading=\"lazy\"`)\n   - Dimensions explicites (width/height)",
      "**Minifier les assets**\n   - CSS et JavaScript minifiés\n   - Suppression du code inutilisé\n   - Bundle splitting si nécessaire",
      "**Implémenter le cache**\n   - Cache headers appropriés\n   - Service Worker pour offline\n   - Cache API pour les données fréquentes",
      "**Optimiser le rendu**\n   - Critical CSS inline\n   - Defer/async pour les scripts\n   - Réduire les reflows/repaints",
    ];
    recommendations = [
      "Visez un score Lighthouse > 90",
      "Utilisez `preconnect` pour les domaines tiers",
      "Mesurez avant et après chaque optimisation",
    ];
  } else if (isFix) {
    analysis = "Vous avez identifié un problème à corriger. Procédons méthodiquement pour le résoudre.";
    steps = [
      "**Reproduire le bug**\n   - Identifier les étapes exactes de reproduction\n   - Vérifier dans différents navigateurs/appareils",
      "**Diagnostiquer la cause**\n   - Inspecter la console pour les erreurs\n   - Vérifier le réseau (onglet Network)\n   - Identifier le fichier/la fonction en cause",
      "**Appliquer le correctif**\n   - Modifier le code ciblé\n   - Ajouter des gardes (null checks, validation)\n   - Tester les cas limites",
      "**Vérifier la non-régression**\n   - Tester les fonctionnalités adjacentes\n   - Vérifier le responsive\n   - Valider le HTML/CSS",
    ];
    recommendations = [
      "Documentez le bug et sa résolution pour référence future",
      "Ajoutez des tests si possible pour éviter la régression",
      "Vérifiez que le fix ne crée pas d'effets de bord",
    ];
  } else if (isAddFeature) {
    analysis = `Vous souhaitez ajouter une nouvelle fonctionnalité. Voici un plan structuré pour l'implémenter efficacement.`;
    steps = [
      "**Planifier la structure**\n   - Définir les composants nécessaires\n   - Identifier les fichiers à créer/modifier\n   - Prévoir l'architecture des données",
      "**Créer la structure HTML**\n   - Ajouter les éléments dans `index.html`\n   - Utiliser des classes sémantiques\n   - Prévoir l'accessibilité (ARIA)",
      "**Styliser la fonctionnalité** dans `styles.css`\n   - Design cohérent avec le reste du site\n   - Responsive dès le départ\n   - Animations et transitions",
      "**Implémenter la logique** dans `app.js`\n   - Gestion des événements\n   - Validation des entrées\n   - Gestion des erreurs",
    ];
    recommendations = [
      "Commencez par un prototype minimal puis itérez",
      "Gardez la cohérence avec le design existant",
      "Testez la fonctionnalité sur différents appareils",
    ];
  } else if (isModify) {
    analysis = "Vous souhaitez modifier des éléments existants. Procédons de manière ciblée pour minimiser les effets de bord.";
    steps = [
      "**Identifier les fichiers impactés**\n   - Localiser les éléments à modifier\n   - Vérifier les dépendances",
      "**Appliquer les modifications**\n   - Modifier le HTML/CSS/JS concerné\n   - Maintenir la cohérence du design",
      "**Tester les changements**\n   - Vérifier le rendu visuel\n   - Tester le responsive\n   - Valider les interactions",
    ];
    recommendations = [
      "Faites des petites modifications incrémentales",
      "Testez après chaque changement",
      "Gardez une copie de sauvegarde avant modifications majeures",
    ];
  } else {
    // Generic response
    analysis = `Votre demande concerne le développement de votre site web. Voici un plan d'action pour y répondre.`;
    steps = [
      "**Analyser les besoins**\n   - Comprendre l'objectif principal\n   - Identifier les contraintes techniques\n   - Définir les critères de succès",
      "**Planifier l'implémentation**\n   - Lister les fichiers à créer/modifier\n   - Définir l'ordre des tâches\n   - Estimer la complexité",
      "**Implémenter les changements**\n   - Développer la fonctionnalité\n   - Tester régulièrement\n   - Itérer sur le résultat",
      "**Valider et déployer**\n   - Tests cross-browser\n   - Vérification responsive\n   - Déploiement",
    ];
    recommendations = [
      "Décrivez votre demande de manière plus précise pour un plan détaillé",
      "Vous pouvez utiliser le mode de génération pour implémenter directement le code",
      "N'hésitez pas à itérer avec des demandes plus spécifiques",
    ];
  }

  // Format as markdown
  const stepsFormatted = steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  const recsFormatted = recommendations.map(r => `- ${r}`).join('\n');

  return `### Analyse
${analysis}

### Plan d'action
${stepsFormatted}

### Recommandations
${recsFormatted}

---
*Cliquez sur "Implémenter le plan" pour générer automatiquement le code, ou décrivez plus précisément ce que vous souhaitez.*`;
}
