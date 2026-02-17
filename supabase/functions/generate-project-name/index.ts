import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * generate-project-name Edge Function — Local generation (no AI key required)
 *
 * Generates creative project names by extracting keywords from the user prompt
 * and combining them with creative modifiers. No external AI API needed.
 *
 * POST /generate-project-name
 * Body: { prompt }
 * Returns: { projectName }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ projectName: `project-${Date.now().toString(36).slice(-5)}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-project-name] Generating for:', prompt.substring(0, 100));

    const projectName = generateCreativeName(prompt);

    console.log('[generate-project-name] Generated:', projectName);

    return new Response(
      JSON.stringify({ projectName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-project-name] Error:', error);

    // Always return a name, never fail
    const fallbackName = `project-${Date.now().toString(36).slice(-5)}`;
    return new Response(
      JSON.stringify({ projectName: fallbackName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= Creative Name Generator =============

// Domain-specific keyword mappings (French + English)
const DOMAIN_KEYWORDS: Record<string, { prefixes: string[]; suffixes: string[] }> = {
  restaurant: {
    prefixes: ['gastro', 'saveur', 'gourmet', 'bistro', 'table', 'chef'],
    suffixes: ['cuisine', 'menu', 'delice', 'feast', 'taste'],
  },
  tech: {
    prefixes: ['pixel', 'nexus', 'byte', 'cyber', 'code', 'digital', 'quantum'],
    suffixes: ['labs', 'hub', 'forge', 'stack', 'dev', 'tech', 'cloud'],
  },
  ecommerce: {
    prefixes: ['shop', 'market', 'store', 'trade', 'prime'],
    suffixes: ['bazaar', 'mart', 'emporium', 'boutique', 'shop'],
  },
  health: {
    prefixes: ['vital', 'sante', 'zen', 'well', 'pure', 'care'],
    suffixes: ['clinic', 'wellness', 'health', 'vita', 'cure'],
  },
  education: {
    prefixes: ['learn', 'edu', 'brain', 'smart', 'mentor'],
    suffixes: ['academy', 'campus', 'school', 'study', 'mind'],
  },
  creative: {
    prefixes: ['atelier', 'studio', 'art', 'vision', 'design'],
    suffixes: ['creative', 'gallery', 'canvas', 'craft', 'works'],
  },
  nature: {
    prefixes: ['eco', 'green', 'terra', 'flora', 'bio'],
    suffixes: ['garden', 'earth', 'leaf', 'nature', 'bloom'],
  },
  sport: {
    prefixes: ['sport', 'fit', 'power', 'active', 'peak'],
    suffixes: ['arena', 'field', 'gym', 'play', 'zone'],
  },
  immobilier: {
    prefixes: ['habitat', 'maison', 'immo', 'home', 'nest'],
    suffixes: ['estate', 'living', 'place', 'casa', 'dwell'],
  },
  finance: {
    prefixes: ['fintech', 'capital', 'profit', 'invest', 'wealth'],
    suffixes: ['bank', 'finance', 'fund', 'money', 'pay'],
  },
};

// Generic creative words for when no domain is detected
const GENERIC_PREFIXES = [
  'aurora', 'nova', 'stellar', 'prism', 'flux', 'spark',
  'orbit', 'pulse', 'wave', 'drift', 'apex', 'zenith',
  'echo', 'lyra', 'atlas', 'vibe', 'neon', 'opal',
  'summit', 'beacon', 'swift', 'sage', 'bolt', 'ember',
];

const GENERIC_SUFFIXES = [
  'design', 'hub', 'studio', 'lab', 'forge', 'works',
  'craft', 'space', 'core', 'flow', 'base', 'wave',
  'link', 'mind', 'nest', 'arc', 'zone', 'deck',
];

// Stopwords to filter out (French + English)
const STOPWORDS = new Set([
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'car', 'ni', 'que', 'qui', 'quoi',
  'pour', 'par', 'avec', 'dans', 'sur', 'sous', 'en', 'entre',
  'ce', 'cette', 'ces', 'mon', 'ton', 'son', 'notre', 'votre', 'leur',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'est', 'sont', 'suis', 'fait', 'faire', 'avoir', 'être',
  'site', 'web', 'page', 'landing', 'créer', 'creer', 'construire',
  'build', 'make', 'want', 'need', 'like',
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'must',
  'and', 'but', 'or', 'not', 'no', 'yes',
  'for', 'with', 'from', 'to', 'of', 'in', 'on', 'at', 'by',
  'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
  'it', 'its', 'we', 'they', 'me', 'him', 'them',
  'website', 'app', 'application', 'project', 'create', 'simple',
]);

function detectDomain(prompt: string): string | null {
  const lower = prompt.toLowerCase();

  const domainPatterns: Record<string, RegExp> = {
    restaurant: /restaurant|café|bistro|cuisine|chef|menu|gastronomie|pizza|sushi|boulangerie|pâtisserie|traiteur|bar|food/i,
    tech: /tech|startup|saas|logiciel|app|digital|développeur|code|ia|intelligence|software|platform/i,
    ecommerce: /e-?commerce|boutique|shop|magasin|vente|store|marketplace|produit|achat/i,
    health: /santé|médecin|dentiste|kiné|clinique|cabinet|psychologue|bien-être|spa|massage|pharma/i,
    education: /éducation|formation|cours|école|université|apprendre|tutoriel|learn|school|academy/i,
    creative: /design|graphi|photo|vidéo|art|créati|studio|agence|portfolio/i,
    nature: /nature|bio|écolo|jardin|paysagiste|ferme|agriculture|plante|fleur/i,
    sport: /sport|fitness|gym|musculation|yoga|running|coach sportif|athlète/i,
    immobilier: /immobilier|maison|appartement|logement|location|villa|propriété|real estate/i,
    finance: /finance|banque|assurance|invest|comptab|trading|crypto|fintech/i,
  };

  for (const [domain, pattern] of Object.entries(domainPatterns)) {
    if (pattern.test(lower)) return domain;
  }

  return null;
}

function extractKeywords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-zàâäéèêëïîôöùûüÿæœç0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word))
    .slice(0, 5);
}

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateCreativeName(prompt: string): string {
  const domain = detectDomain(prompt);
  const keywords = extractKeywords(prompt);
  const uniqueSeed = prompt + Date.now().toString();
  const rng = seededRandom(uniqueSeed);

  let prefix: string;
  let suffix: string;

  if (domain && DOMAIN_KEYWORDS[domain]) {
    const domainWords = DOMAIN_KEYWORDS[domain];
    // Mix: sometimes use a keyword from the prompt, sometimes from domain
    if (keywords.length > 0 && rng() > 0.4) {
      prefix = pick(keywords, rng);
    } else {
      prefix = pick(domainWords.prefixes, rng);
    }
    suffix = pick(domainWords.suffixes, rng);
  } else {
    // No domain detected: use a keyword + generic creative word
    if (keywords.length > 0) {
      prefix = pick(keywords, rng);
      suffix = pick(GENERIC_SUFFIXES, rng);
    } else {
      prefix = pick(GENERIC_PREFIXES, rng);
      suffix = pick(GENERIC_SUFFIXES, rng);
    }
  }

  // Format as slug
  const name = `${prefix}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  // Ensure minimum length
  if (name.length < 4) {
    return `${pick(GENERIC_PREFIXES, rng)}-${pick(GENERIC_SUFFIXES, rng)}`;
  }

  return name;
}
