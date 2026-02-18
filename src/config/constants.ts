/**
 * Configuration et constantes pour le système de crédits et tarification
 * Basé sur Cloudflare VibeSDK
 */

// ============= Plans & Pricing =============

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    messagesPerMonth: 5,
    costPerUserPerMonth: 0.175, // ~$0.175 en tokens
    features: {
      deployment: true,
      maxPublishedSites: 1,
      customDomain: false,
      previewDuration: '24h',
      prioritySupport: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 12.99,
    messagesPerMonth: 50,
    costPerUserPerMonth: 1.75, // ~$1.75 en tokens
    features: {
      deployment: true,
      maxPublishedSites: -1, // unlimited
      customDomain: true,
      previewDuration: 'unlimited',
      prioritySupport: true,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ============= Token Pricing =============

export const TOKEN_PRICING = {
  inputPerMillion: 1.50,  // $1.50 per 1M input tokens
  outputPerMillion: 7.50, // $7.50 per 1M output tokens
} as const;

/**
 * Calcule le coût en dollars pour un nombre de tokens donné
 */
export function calculateTokenCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens * TOKEN_PRICING.inputPerMillion) / 1_000_000;
  const outputCost = (outputTokens * TOKEN_PRICING.outputPerMillion) / 1_000_000;
  return inputCost + outputCost;
}

// ============= VibeSDK Configuration =============

export const VIBESDK_CONFIG = {
  // URL de votre instance VibeSDK déployée (ou build.cloudflare.dev pour le service public)
  baseUrl: 'https://build.cloudflare.dev',
  defaultProjectType: 'app' as const,
  defaultBehaviorType: 'phasic' as const,
} as const;

// ============= Rate Limits =============

export const RATE_LIMITS = {
  free: {
    messagesPerMonth: 5,
    requestsPerMinute: 3,
  },
  premium: {
    messagesPerMonth: 50,
    requestsPerMinute: 10,
  },
} as const;

// ============= Credit System =============

export function getMessageLimit(plan: PlanId): number {
  return PLANS[plan].messagesPerMonth;
}

export function canDeploy(plan: PlanId): boolean {
  return PLANS[plan].features.deployment;
}

export function getRemainingMessages(plan: PlanId, used: number): number {
  return Math.max(0, PLANS[plan].messagesPerMonth - used);
}

export function isOverLimit(plan: PlanId, used: number): boolean {
  return used >= PLANS[plan].messagesPerMonth;
}
