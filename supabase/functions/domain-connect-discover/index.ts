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

    const cnameTarget = 'proxy.builtbymagellan.com';
    const templateProviderId = 'builtbymagellan.com';
    const templateServiceId = 'websitehosting';

    // 1. Query _domainconnect TXT record via DNS-over-HTTPS
    const providerUrl = await queryDomainConnectTXT(domain);

    if (!providerUrl) {
      console.log('[Discovery] No _domainconnect record found for', domain);

      // Fallback: Détecter provider via nameservers
      const providerName = await detectProviderFromNameservers(domain);

      return new Response(
        JSON.stringify({
          success: true,
          supported: false,
          method: 'manual',
          providerName: providerName || 'Votre hébergeur DNS',
          instructions: createManualInstructions(domain, cnameTarget, providerName)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch provider settings
    const provider = await fetchProviderSettings(providerUrl, domain);

    if (!provider) {
      console.log('[Discovery] Failed to fetch provider settings');

      return new Response(
        JSON.stringify({
          success: true,
          supported: false,
          method: 'manual',
          instructions: createManualInstructions(domain, cnameTarget)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Vérifier support du template
    const templateSupported = await checkTemplateSupport(provider, templateProviderId, templateServiceId);

    if (!templateSupported) {
      console.log('[Discovery] Template not supported by provider');

      return new Response(
        JSON.stringify({
          success: true,
          supported: false,
          method: 'manual',
          providerName: provider.providerName,
          instructions: createManualInstructions(domain, cnameTarget, provider.providerName)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Générer l'URL de connexion
    const redirectUri = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://builtbymagellan.com';
    const connectUrl = generateSyncURL(
      provider,
      domain,
      templateProviderId,
      templateServiceId,
      `${redirectUri}/dashboard?section=siteweb&domain_connected=true`
    );

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
    console.error('Error in domain-connect-discover:', error);
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

    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.Answer && data.Answer.length > 0) {
      const txtValue = data.Answer[0].data.replace(/"/g, '');
      return txtValue;
    }

    return null;
  } catch (error) {
    console.error('[Discovery] DNS query error:', error);
    return null;
  }
}

async function fetchProviderSettings(
  providerUrl: string,
  domain: string
): Promise<DNSProviderSettings | null> {
  try {
    const url = `https://${providerUrl}/v2/${domain}/settings`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('[Discovery] Fetch settings error:', error);
    return null;
  }
}

async function checkTemplateSupport(
  provider: DNSProviderSettings,
  templateProviderId: string,
  templateServiceId: string
): Promise<boolean> {
  if (!provider.urlAPI) return false;

  try {
    const url = `${provider.urlAPI}/v2/domainTemplates/providers/${templateProviderId}/services/${templateServiceId}`;

    const response = await fetch(url, { method: 'GET' });

    return response.status === 200;
  } catch (error) {
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

  return `${provider.urlSyncUX}/v2/domainTemplates/providers/${templateProviderId}/services/${templateServiceId}/apply?${params}`;
}

async function detectProviderFromNameservers(domain: string): Promise<string | null> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.Answer || data.Answer.length === 0) return null;

    const nameservers = data.Answer.map((answer: any) => answer.data.toLowerCase());

    const providerMap: Record<string, string> = {
      'godaddy': 'GoDaddy',
      'cloudflare': 'Cloudflare',
      'ovh': 'OVH',
      'gandi': 'Gandi',
      'namecheap': 'Namecheap',
      'ionos': '1&1 IONOS',
      'google': 'Google Domains',
      'name.com': 'Name.com',
      'dnsimple': 'DNSimple',
      'hover': 'Hover',
      'dreamhost': 'DreamHost'
    };

    for (const ns of nameservers) {
      for (const [key, provider] of Object.entries(providerMap)) {
        if (ns.includes(key)) {
          return provider;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[Discovery] Nameserver detection error:', error);
    return null;
  }
}

function createManualInstructions(domain: string, cnameTarget: string, providerName?: string) {
  return {
    provider: providerName || 'Votre hébergeur DNS',
    steps: [
      {
        title: 'Connectez-vous à votre hébergeur DNS',
        description: `Rendez-vous sur ${providerName || 'le site de votre hébergeur DNS'}`
      },
      {
        title: 'Accédez à la gestion DNS',
        description: 'Trouvez la section "DNS" ou "Zone DNS" ou "Gestion DNS"'
      },
      {
        title: 'Ajoutez ces enregistrements CNAME',
        description: 'Créez deux enregistrements CNAME comme indiqué ci-dessous'
      }
    ],
    records: [
      {
        type: 'CNAME',
        name: '@',
        value: cnameTarget,
        ttl: '3600'
      },
      {
        type: 'CNAME',
        name: 'www',
        value: cnameTarget,
        ttl: '3600'
      }
    ]
  };
}
