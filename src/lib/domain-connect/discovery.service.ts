/**
 * Domain Connect Discovery Service
 * Découvre le DNS Provider et génère les URLs Domain Connect
 */

export interface DNSProviderSettings {
  providerId: string;
  providerName: string;
  providerDisplayName?: string;
  urlSyncUX?: string;
  urlAsyncUX?: string;
  urlAPI: string;
  width?: number;
  height?: number;
  urlControlPanel?: string;
  nameServers?: string[];
}

export interface DiscoveryResult {
  supported: boolean;
  method: 'automatic' | 'manual';
  provider?: DNSProviderSettings;
  providerName?: string;
  connectUrl?: string;
  instructions?: {
    provider: string;
    steps: Array<{
      title: string;
      description: string;
    }>;
    records: Array<{
      type: string;
      name: string;
      value: string;
      ttl: string;
    }>;
  };
}

/**
 * Liste des providers connus qui supportent Domain Connect
 * Ces providers importent régulièrement les templates du repo officiel
 */
export const DOMAIN_CONNECT_PROVIDERS = {
  GODADDY: {
    id: 'domainconnect.godaddy.com',
    name: 'GoDaddy',
    displayName: 'GoDaddy',
    logo: 'https://img1.wsimg.com/cdn/Image/All/Logos/1/en-US/8f087ce7-2ff0-4e3f-9199-4d42afd4bc78/GoDaddy-Mascot-Full-Color-Dark-Bkgnd-RGB.png',
    supportsSync: true,
    supportsAsync: true,
    controlPanel: 'https://dcc.godaddy.com'
  },
  IONOS: {
    id: 'domainconnect.1and1.com',
    name: '1&1 IONOS',
    displayName: '1&1 IONOS',
    logo: 'https://www.ionos.com/favicon.ico',
    supportsSync: true,
    supportsAsync: false,
    controlPanel: 'https://my.ionos.com'
  },
  PLESK: {
    id: 'plesk.com',
    name: 'Plesk',
    displayName: 'Plesk',
    logo: 'https://www.plesk.com/favicon.ico',
    supportsSync: true,
    supportsAsync: false,
    controlPanel: null
  },
  UNITED_DOMAINS: {
    id: 'domainconnect.united-domains.de',
    name: 'United Domains',
    displayName: 'United Domains',
    logo: 'https://www.united-domains.de/favicon.ico',
    supportsSync: true,
    supportsAsync: false,
    controlPanel: 'https://www.united-domains.de'
  }
} as const;

/**
 * Providers qui NE supportent PAS Domain Connect
 * (pour afficher un message approprié à l'utilisateur)
 */
export const NON_DOMAIN_CONNECT_PROVIDERS = [
  'Namecheap',
  'Cloudflare', 
  'OVH',
  'Gandi',
  'Google Domains',
  'AWS Route 53',
  'DigitalOcean',
  'Linode',
  'Vultr',
  'DreamHost',
  'Bluehost',
  'HostGator',
  'Hover',
  'Name.com'
];

// Cache pour les résultats de discovery (évite les requêtes répétées)
const discoveryCache = new Map<string, { result: DiscoveryResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class DomainConnectDiscovery {
  private readonly TEMPLATE_PROVIDER_ID = 'builtbymagellan.com';
  private readonly TEMPLATE_SERVICE_ID = 'websitehosting';

  /**
   * Découverte du DNS Provider via Domain Connect
   * Cette fonction est appelée côté client (browser)
   */
  async discoverProvider(domain: string, cnameTarget: string): Promise<DiscoveryResult> {
    // Vérifier le cache
    const cached = discoveryCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Discovery] Using cached result for', domain);
      return cached.result;
    }

    try {
      // 1. Query _domainconnect TXT record via DNS-over-HTTPS
      const providerUrl = await this.queryDomainConnectTXT(domain);

      if (!providerUrl) {
        console.log('[Discovery] No _domainconnect record found');
        const result = await this.createManualInstructions(domain, cnameTarget);
        this.cacheResult(domain, result);
        return result;
      }

      console.log('[Discovery] Found _domainconnect record:', providerUrl);

      // 2. Fetch provider settings
      const provider = await this.fetchProviderSettings(providerUrl, domain);

      if (!provider) {
        console.log('[Discovery] Failed to fetch provider settings');
        const result = await this.createManualInstructions(domain, cnameTarget);
        this.cacheResult(domain, result);
        return result;
      }

      console.log('[Discovery] Provider settings:', provider.providerName);

      // 3. Vérifier support du template
      const templateSupported = await this.checkTemplateSupport(provider);

      if (!templateSupported) {
        console.log('[Discovery] Template not supported by provider');
        const result = await this.createManualInstructions(domain, cnameTarget, provider.providerName);
        this.cacheResult(domain, result);
        return result;
      }

      console.log('[Discovery] Template supported! Generating connect URL');

      // 4. Générer l'URL de connexion
      const connectUrl = this.generateSyncURL(provider, domain, cnameTarget);

      const result: DiscoveryResult = {
        supported: true,
        method: 'automatic',
        provider,
        connectUrl
      };

      this.cacheResult(domain, result);
      return result;

    } catch (error) {
      console.error('[Discovery] Error:', error);
      const result = await this.createManualInstructions(domain, cnameTarget);
      this.cacheResult(domain, result);
      return result;
    }
  }

  private cacheResult(domain: string, result: DiscoveryResult): void {
    discoveryCache.set(domain, { result, timestamp: Date.now() });
  }

  /**
   * Vider le cache (utile pour forcer une nouvelle découverte)
   */
  static clearCache(): void {
    discoveryCache.clear();
  }

  /**
   * Query _domainconnect TXT record via DNS-over-HTTPS (Cloudflare)
   */
  private async queryDomainConnectTXT(domain: string): Promise<string | null> {
    try {
      const dnsQuery = `_domainconnect.${domain}`;
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;

      console.log('[Discovery] Querying DNS TXT:', dnsQuery);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      if (!response.ok) {
        console.log('[Discovery] DNS query failed:', response.status);
        return null;
      }

      const data = await response.json();

      if (data.Answer && data.Answer.length > 0) {
        // Extraire la valeur TXT (enlever les quotes)
        const txtValue = data.Answer[0].data.replace(/"/g, '');
        console.log('[Discovery] TXT record found:', txtValue);
        return txtValue;
      }

      console.log('[Discovery] No TXT answer found');
      return null;
    } catch (error) {
      console.error('[Discovery] DNS query error:', error);
      return null;
    }
  }

  /**
   * Fetch settings from DNS Provider API
   */
  private async fetchProviderSettings(
    providerUrl: string,
    domain: string
  ): Promise<DNSProviderSettings | null> {
    try {
      const url = `https://${providerUrl}/v2/${domain}/settings`;
      console.log('[Discovery] Fetching provider settings:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('[Discovery] Provider settings fetch failed:', response.status);
        return null;
      }

      const settings = await response.json();
      console.log('[Discovery] Provider settings received:', settings);
      return settings;
    } catch (error) {
      console.error('[Discovery] Fetch settings error:', error);
      return null;
    }
  }

  /**
   * Vérifier si le provider supporte notre template
   */
  private async checkTemplateSupport(
    provider: DNSProviderSettings
  ): Promise<boolean> {
    if (!provider.urlAPI) {
      console.log('[Discovery] No urlAPI in provider settings');
      return false;
    }

    try {
      const url = `${provider.urlAPI}/v2/domainTemplates/providers/${this.TEMPLATE_PROVIDER_ID}/services/${this.TEMPLATE_SERVICE_ID}`;
      console.log('[Discovery] Checking template support:', url);

      const response = await fetch(url, {
        method: 'GET'
      });

      console.log('[Discovery] Template check response:', response.status);
      // 200 = supported, 404 = not supported
      return response.status === 200;
    } catch (error) {
      console.error('[Discovery] Template check error:', error);
      return false;
    }
  }

  /**
   * Générer l'URL de connexion synchrone
   */
  generateSyncURL(
    provider: DNSProviderSettings,
    domain: string,
    cnameTarget: string
  ): string {
    if (!provider.urlSyncUX) {
      throw new Error('Provider does not support sync flow');
    }

    const redirectUri = `${window.location.origin}/dashboard?section=siteweb&domain_connected=true`;
    const state = this.generateState();

    const params = new URLSearchParams({
      domain: domain,
      target: cnameTarget, // Variable pour le template
      redirect_uri: redirectUri,
      state: state
    });

    // Format: {urlSyncUX}/v2/domainTemplates/providers/{providerId}/services/{serviceId}/apply
    const connectUrl = `${provider.urlSyncUX}/v2/domainTemplates/providers/${this.TEMPLATE_PROVIDER_ID}/services/${this.TEMPLATE_SERVICE_ID}/apply?${params}`;
    console.log('[Discovery] Generated connect URL:', connectUrl);
    return connectUrl;
  }

  /**
   * Fallback: Créer instructions manuelles
   */
  private async createManualInstructions(
    domain: string,
    cnameTarget: string,
    providerName?: string
  ): Promise<DiscoveryResult> {
    // Essayer de détecter le provider via nameservers (DNS-over-HTTPS)
    if (!providerName) {
      providerName = await this.detectProviderFromNameservers(domain);
    }

    // Vérifier si c'est un provider qui ne supporte PAS Domain Connect
    const isDomainConnectUnsupported = providerName && 
      NON_DOMAIN_CONNECT_PROVIDERS.includes(providerName);

    const providerDisplayName = providerName || 'Votre hébergeur DNS';

    return {
      supported: false,
      method: 'manual',
      providerName: providerDisplayName,
      instructions: {
        provider: providerDisplayName,
        steps: this.getProviderSpecificSteps(providerName),
        records: [
          {
            type: 'A',
            name: '@',
            value: '185.158.133.1',
            ttl: '3600'
          },
          {
            type: 'CNAME',
            name: 'www',
            value: cnameTarget,
            ttl: '3600'
          }
        ]
      }
    };
  }

  /**
   * Obtenir les instructions spécifiques selon le provider
   */
  private getProviderSpecificSteps(providerName?: string): Array<{ title: string; description: string }> {
    const baseSteps = [
      {
        title: 'Connectez-vous à votre hébergeur DNS',
        description: providerName 
          ? `Rendez-vous sur ${providerName} et connectez-vous à votre compte`
          : 'Rendez-vous sur le site de votre hébergeur DNS'
      },
      {
        title: 'Accédez à la gestion DNS',
        description: 'Trouvez la section "DNS", "Zone DNS" ou "Gestion des enregistrements"'
      }
    ];

    // Instructions spécifiques par provider
    if (providerName === 'Cloudflare') {
      return [
        ...baseSteps,
        {
          title: 'Désactivez le proxy Cloudflare',
          description: 'Cliquez sur le nuage orange pour le passer en gris (DNS only)'
        },
        {
          title: 'Ajoutez les enregistrements',
          description: 'Créez les enregistrements A et CNAME ci-dessous'
        }
      ];
    }

    if (providerName === 'OVH') {
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
          description: 'Cliquez sur "Ajouter une entrée" et créez les enregistrements ci-dessous'
        }
      ];
    }

    if (providerName === 'Namecheap') {
      return [
        ...baseSteps,
        {
          title: 'Allez dans "Advanced DNS"',
          description: 'Dans le dashboard Namecheap, cliquez sur "Manage" puis "Advanced DNS"'
        },
        {
          title: 'Ajoutez les enregistrements',
          description: 'Cliquez sur "Add New Record" et créez les enregistrements ci-dessous'
        }
      ];
    }

    // Instructions génériques
    return [
      ...baseSteps,
      {
        title: 'Supprimez les anciens enregistrements',
        description: 'Supprimez tout enregistrement A ou CNAME existant pour @ et www'
      },
      {
        title: 'Ajoutez les nouveaux enregistrements',
        description: 'Créez les enregistrements suivants exactement comme indiqué'
      }
    ];
  }

  /**
   * Détecter le provider via nameservers (DNS-over-HTTPS)
   */
  private async detectProviderFromNameservers(domain: string): Promise<string | null> {
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (!data.Answer || data.Answer.length === 0) return null;

      const nameservers = data.Answer.map((answer: any) => 
        answer.data.toLowerCase().replace(/\.$/, '')
      );

      console.log('[Discovery] Nameservers found:', nameservers);

      // Patterns de détection améliorés avec regex
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
        'Online.net': [/online\.net/i, /scaleway/i],
        'Hetzner': [/hetzner/i]
      };

      for (const ns of nameservers) {
        for (const [provider, patterns] of Object.entries(providerPatterns)) {
          for (const pattern of patterns) {
            if (pattern.test(ns)) {
              console.log(`[Discovery] Provider detected: ${provider} (matched ${pattern} in ${ns})`);
              return provider;
            }
          }
        }
      }

      console.log('[Discovery] No provider matched for nameservers');
      return null;
    } catch (error) {
      console.error('[Discovery] Nameserver detection error:', error);
      return null;
    }
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
}

// Export une instance par défaut pour faciliter l'utilisation
export const domainConnectDiscovery = new DomainConnectDiscovery();
