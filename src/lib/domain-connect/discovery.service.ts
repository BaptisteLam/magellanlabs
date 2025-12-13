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

export class DomainConnectDiscovery {
  private readonly TEMPLATE_PROVIDER_ID = 'builtbymagellan.com';
  private readonly TEMPLATE_SERVICE_ID = 'websitehosting';

  /**
   * Découverte du DNS Provider via Domain Connect
   * Cette fonction est appelée côté client (browser)
   */
  async discoverProvider(domain: string, cnameTarget: string): Promise<DiscoveryResult> {
    try {
      // 1. Query _domainconnect TXT record via DNS-over-HTTPS
      const providerUrl = await this.queryDomainConnectTXT(domain);

      if (!providerUrl) {
        console.log('[Discovery] No _domainconnect record found');
        return await this.createManualInstructions(domain, cnameTarget);
      }

      // 2. Fetch provider settings
      const provider = await this.fetchProviderSettings(providerUrl, domain);

      if (!provider) {
        console.log('[Discovery] Failed to fetch provider settings');
        return await this.createManualInstructions(domain, cnameTarget);
      }

      // 3. Vérifier support du template
      const templateSupported = await this.checkTemplateSupport(provider);

      if (!templateSupported) {
        console.log('[Discovery] Template not supported by provider');
        return await this.createManualInstructions(domain, cnameTarget, provider.providerName);
      }

      // 4. Générer l'URL de connexion
      const connectUrl = this.generateSyncURL(provider, domain, cnameTarget);

      return {
        supported: true,
        method: 'automatic',
        provider,
        connectUrl
      };

    } catch (error) {
      console.error('[Discovery] Error:', error);
      return await this.createManualInstructions(domain, cnameTarget);
    }
  }

  /**
   * Query _domainconnect TXT record via DNS-over-HTTPS (Cloudflare)
   */
  private async queryDomainConnectTXT(domain: string): Promise<string | null> {
    try {
      const dnsQuery = `_domainconnect.${domain}`;
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.Answer && data.Answer.length > 0) {
        // Extraire la valeur TXT (enlever les quotes)
        const txtValue = data.Answer[0].data.replace(/"/g, '');
        return txtValue;
      }

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

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
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
    if (!provider.urlAPI) return false;

    try {
      const url = `${provider.urlAPI}/v2/domainTemplates/providers/${this.TEMPLATE_PROVIDER_ID}/services/${this.TEMPLATE_SERVICE_ID}`;

      const response = await fetch(url, {
        method: 'GET'
      });

      // 200 = supported, 404 = not supported
      return response.status === 200;
    } catch (error) {
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
    return `${provider.urlSyncUX}/v2/domainTemplates/providers/${this.TEMPLATE_PROVIDER_ID}/services/${this.TEMPLATE_SERVICE_ID}/apply?${params}`;
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

    return {
      supported: false,
      method: 'manual',
      providerName: providerName || 'Votre hébergeur DNS',
      instructions: {
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
      }
    };
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

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
}
