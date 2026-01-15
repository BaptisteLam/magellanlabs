import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DNSProviderSettings {
  providerId: string;
  providerName: string;
  providerDisplayName?: string;
  urlSyncUX?: string;
  urlAsyncUX?: string;
  urlAPI: string;
  width?: number;
  height?: number;
}

/**
 * Liste des providers qui supportent Domain Connect
 */
const DOMAIN_CONNECT_PROVIDERS = {
  'domainconnect.godaddy.com': {
    name: 'GoDaddy',
    displayName: 'GoDaddy',
    supportsSync: true
  },
  'domainconnect.1and1.com': {
    name: '1&1 IONOS', 
    displayName: '1&1 IONOS',
    supportsSync: true
  },
  'plesk.com': {
    name: 'Plesk',
    displayName: 'Plesk',
    supportsSync: true
  }
};

/**
 * Providers qui NE supportent PAS Domain Connect
 */
const NON_DOMAIN_CONNECT_PROVIDERS = [
  'Namecheap', 'Cloudflare', 'OVH', 'Gandi', 'Google Domains',
  'AWS Route 53', 'DigitalOcean', 'Linode', 'Vultr',
  'DreamHost', 'Bluehost', 'HostGator', 'Hover', 'Name.com'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, message: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Discovery] Starting discovery for domain: ${domain}`);

    const cnameTarget = 'proxy.builtbymagellan.com';
    const templateProviderId = 'builtbymagellan.com';
    const templateServiceId = 'websitehosting';

    // 1. Query _domainconnect TXT record via DNS-over-HTTPS
    console.log('[Discovery] Step 1: Querying _domainconnect TXT record...');
    const providerUrl = await queryDomainConnectTXT(domain);

    if (!providerUrl) {
      console.log('[Discovery] No _domainconnect record found, falling back to nameserver detection');

      // Fallback: Détecter provider via nameservers
      const providerName = await detectProviderFromNameservers(domain);
      console.log(`[Discovery] Detected provider via nameservers: ${providerName || 'unknown'}`);

      // Vérifier si c'est un provider Domain Connect connu
      const isDomainConnectSupported = providerName && 
        ['GoDaddy', '1&1 IONOS', 'Plesk'].includes(providerName);

      if (isDomainConnectSupported) {
        console.log('[Discovery] Provider supports Domain Connect but TXT record not found');
      }

      return new Response(
        JSON.stringify({
          success: true,
          supported: false,
          method: 'manual',
          providerName: providerName || 'Votre hébergeur DNS',
          isDomainConnectProvider: isDomainConnectSupported,
          instructions: createManualInstructions(domain, cnameTarget, providerName)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Discovery] Found _domainconnect TXT record: ${providerUrl}`);

    // 2. Fetch provider settings
    console.log('[Discovery] Step 2: Fetching provider settings...');
    const provider = await fetchProviderSettings(providerUrl, domain);

    if (!provider) {
      console.log('[Discovery] Failed to fetch provider settings');

      return new Response(
        JSON.stringify({
          success: true,
          supported: false,
          method: 'manual',
          providerName: providerUrl,
          instructions: createManualInstructions(domain, cnameTarget)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Discovery] Provider settings received: ${JSON.stringify(provider)}`);

    // 3. Vérifier support du template
    console.log('[Discovery] Step 3: Checking template support...');
    const templateSupported = await checkTemplateSupport(provider, templateProviderId, templateServiceId);

    if (!templateSupported) {
      console.log('[Discovery] Template not supported by provider');
      console.log('[Discovery] Note: Template may need to be submitted to Domain Connect repo');

      return new Response(
        JSON.stringify({
          success: true,
          supported: false,
          method: 'manual',
          providerName: provider.providerName,
          templateNotYetSupported: true,
          instructions: createManualInstructions(domain, cnameTarget, provider.providerName)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Discovery] ✅ Template is supported!');

    // 4. Générer l'URL de connexion
    const magellanUrl = Deno.env.get('MAGELLAN_URL') || 'https://builtbymagellan.com';
    const redirectUri = `${magellanUrl}/dashboard?section=siteweb&domain_connected=true`;
    
    console.log('[Discovery] Step 4: Generating connect URL...');
    const connectUrl = generateSyncURL(
      provider,
      domain,
      templateProviderId,
      templateServiceId,
      redirectUri
    );

    console.log(`[Discovery] Connect URL generated: ${connectUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        supported: true,
        method: 'automatic',
        provider: {
          id: provider.providerId,
          name: provider.providerName,
          displayName: provider.providerDisplayName || provider.providerName
        },
        connectUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Discovery] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function queryDomainConnectTXT(domain: string): Promise<string | null> {
  try {
    const dnsQuery = `_domainconnect.${domain}`;
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;

    console.log(`[DNS] Querying: ${dnsQuery}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) {
      console.log(`[DNS] Query failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[DNS] Response:`, JSON.stringify(data));

    if (data.Answer && data.Answer.length > 0) {
      const txtValue = data.Answer[0].data.replace(/"/g, '');
      console.log(`[DNS] TXT value found: ${txtValue}`);
      return txtValue;
    }

    console.log('[DNS] No Answer in response');
    return null;
  } catch (error) {
    console.error('[DNS] Query error:', error);
    return null;
  }
}

async function fetchProviderSettings(
  providerUrl: string,
  domain: string
): Promise<DNSProviderSettings | null> {
  try {
    const url = `https://${providerUrl}/v2/${domain}/settings`;
    console.log(`[Provider] Fetching settings from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log(`[Provider] Settings fetch failed: ${response.status}`);
      return null;
    }

    const settings = await response.json();
    console.log(`[Provider] Settings:`, JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.error('[Provider] Fetch settings error:', error);
    return null;
  }
}

async function checkTemplateSupport(
  provider: DNSProviderSettings,
  templateProviderId: string,
  templateServiceId: string
): Promise<boolean> {
  if (!provider.urlAPI) {
    console.log('[Template] No urlAPI in provider settings');
    return false;
  }

  try {
    const url = `${provider.urlAPI}/v2/domainTemplates/providers/${templateProviderId}/services/${templateServiceId}`;
    console.log(`[Template] Checking support at: ${url}`);

    const response = await fetch(url, { method: 'GET' });
    console.log(`[Template] Response status: ${response.status}`);

    return response.status === 200;
  } catch (error) {
    console.error('[Template] Check error:', error);
    return false;
  }
}

function generateSyncURL(
  provider: DNSProviderSettings,
  domain: string,
  templateProviderId: string,
  templateServiceId: string,
  redirectUri: string
): string {
  if (!provider.urlSyncUX) {
    throw new Error('Provider does not support sync flow');
  }

  const state = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  const params = new URLSearchParams({
    domain: domain,
    redirect_uri: redirectUri,
    state: state
  });

  const connectUrl = `${provider.urlSyncUX}/v2/domainTemplates/providers/${templateProviderId}/services/${templateServiceId}/apply?${params}`;
  console.log(`[Sync] Generated URL: ${connectUrl}`);
  return connectUrl;
}

async function detectProviderFromNameservers(domain: string): Promise<string | null> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`;
    console.log(`[NS] Querying nameservers for: ${domain}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) {
      console.log(`[NS] Query failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.Answer || data.Answer.length === 0) {
      console.log('[NS] No nameservers found');
      return null;
    }

    const nameservers = data.Answer.map((answer: any) => 
      answer.data.toLowerCase().replace(/\.$/, '')
    );

    console.log('[NS] Nameservers found:', nameservers);

    // Patterns de détection améliorés
    const providerPatterns: Record<string, RegExp[]> = {
      'GoDaddy': [/godaddy/i, /domaincontrol/i],
      'Cloudflare': [/cloudflare/i],
      'OVH': [/ovh/i, /ovhcloud/i, /anycast\.me/i],
      'Gandi': [/gandi/i],
      'Namecheap': [/namecheap/i, /registrar-servers\.com/i, /dns\.com/i],
      '1&1 IONOS': [/ionos/i, /1and1/i, /ui-dns/i],
      'Google Domains': [/google/i, /ns-cloud/i],
      'Name.com': [/name\.com/i],
      'DNSimple': [/dnsimple/i],
      'Hover': [/hover/i],
      'DreamHost': [/dreamhost/i],
      'HostGator': [/hostgator/i],
      'Bluehost': [/bluehost/i],
      'AWS Route 53': [/awsdns/i, /amazonaws/i],
      'DigitalOcean': [/digitalocean/i],
      'Linode': [/linode/i],
      'Vultr': [/vultr/i],
      'Infomaniak': [/infomaniak/i],
      'Hetzner': [/hetzner/i],
      'Online.net': [/online\.net/i, /scaleway/i]
    };

    for (const ns of nameservers) {
      for (const [provider, patterns] of Object.entries(providerPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(ns)) {
            console.log(`[NS] Matched provider: ${provider} (pattern: ${pattern} in ${ns})`);
            return provider;
          }
        }
      }
    }

    console.log('[NS] No provider matched');
    return null;
  } catch (error) {
    console.error('[NS] Detection error:', error);
    return null;
  }
}

function createManualInstructions(domain: string, cnameTarget: string, providerName?: string | null) {
  const PROXY_IP = '185.158.133.1';
  
  // Instructions spécifiques par provider
  const getSteps = (provider?: string | null) => {
    const baseSteps = [
      {
        title: 'Connectez-vous à votre hébergeur DNS',
        description: provider 
          ? `Rendez-vous sur ${provider} et connectez-vous à votre compte`
          : 'Rendez-vous sur le site de votre hébergeur DNS'
      },
      {
        title: 'Accédez à la gestion DNS',
        description: 'Trouvez la section "DNS", "Zone DNS" ou "Gestion DNS"'
      }
    ];

    if (provider === 'Cloudflare') {
      return [
        ...baseSteps,
        {
          title: 'Désactivez le proxy Cloudflare (optionnel)',
          description: 'Pour les enregistrements A et CNAME, passez le nuage en gris (DNS only) si vous rencontrez des problèmes'
        },
        {
          title: 'Ajoutez les enregistrements',
          description: 'Créez les enregistrements A et CNAME ci-dessous'
        }
      ];
    }

    if (provider === 'OVH') {
      return [
        ...baseSteps,
        {
          title: 'Allez dans "Zone DNS"',
          description: 'Dans le manager OVH, sélectionnez votre domaine puis "Zone DNS"'
        },
        {
          title: 'Supprimez les anciens enregistrements',
          description: 'Supprimez les enregistrements A et CNAME existants pour @ et www'
        },
        {
          title: 'Ajoutez les nouveaux enregistrements',
          description: 'Cliquez sur "Ajouter une entrée"'
        }
      ];
    }

    if (provider === 'Namecheap') {
      return [
        ...baseSteps,
        {
          title: 'Allez dans "Advanced DNS"',
          description: 'Dans le dashboard, cliquez sur "Manage" puis "Advanced DNS"'
        },
        {
          title: 'Ajoutez les enregistrements',
          description: 'Cliquez sur "Add New Record"'
        }
      ];
    }

    return [
      ...baseSteps,
      {
        title: 'Supprimez les anciens enregistrements',
        description: 'Supprimez tout enregistrement A ou CNAME pour @ et www'
      },
      {
        title: 'Ajoutez les nouveaux enregistrements',
        description: 'Créez les enregistrements suivants'
      }
    ];
  };

  return {
    provider: providerName || 'Votre hébergeur DNS',
    steps: getSteps(providerName),
    records: [
      {
        type: 'A',
        name: '@',
        value: PROXY_IP,
        ttl: '3600',
        description: `Enregistrement A pour le domaine racine (${domain})`
      },
      {
        type: 'CNAME',
        name: 'www',
        value: cnameTarget,
        ttl: '3600',
        description: `Enregistrement CNAME pour www.${domain}`
      }
    ],
    notes: [
      'Le symbole @ représente votre domaine racine',
      'TTL 3600 = 1 heure (valeur standard)',
      'La propagation peut prendre jusqu\'à 24h'
    ]
  };
}
