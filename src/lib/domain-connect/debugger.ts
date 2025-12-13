/**
 * Outil de test et debug pour Domain Connect
 * Utiliser dans la console browser ou dans un composant de test
 */

export class DomainConnectDebugger {
  /**
   * Tester la découverte d'un domaine
   */
  static async testDiscovery(domain: string) {
    console.group(`🔍 Testing Domain Connect Discovery: ${domain}`);

    // 1. Test _domainconnect TXT record
    console.log('1️⃣ Querying _domainconnect TXT record...');
    const domainConnectRecord = await this.queryDomainConnectTXT(domain);
    console.log('Result:', domainConnectRecord || '❌ Not found');

    // 2. Test nameservers
    console.log('\n2️⃣ Querying nameservers...');
    const nameservers = await this.queryNameservers(domain);
    console.log('Nameservers:', nameservers);

    // 3. Detect provider
    console.log('\n3️⃣ Detecting provider...');
    const provider = this.detectProvider(nameservers);
    console.log('Provider:', provider || '❌ Unknown');

    // 4. Summary
    console.log('\n📊 Summary:');
    console.table({
      'Domain': domain,
      'Domain Connect': domainConnectRecord ? '✅ Supported' : '❌ Not supported',
      'Nameservers': nameservers.join(', '),
      'Provider Detected': provider || 'Unknown',
      'Method': domainConnectRecord ? 'Automatic' : 'Manual'
    });

    console.groupEnd();

    return {
      domain,
      domainConnectRecord,
      nameservers,
      provider,
      supported: !!domainConnectRecord,
      method: domainConnectRecord ? 'automatic' : 'manual'
    };
  }

  /**
   * Query _domainconnect TXT record
   */
  private static async queryDomainConnectTXT(domain: string): Promise<string | null> {
    try {
      const dnsQuery = `_domainconnect.${domain}`;
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      console.log('DNS-over-HTTPS Response:', data);

      if (data.Answer && data.Answer.length > 0) {
        return data.Answer[0].data.replace(/"/g, '');
      }

      return null;
    } catch (error) {
      console.error('Error querying _domainconnect:', error);
      return null;
    }
  }

  /**
   * Query nameservers
   */
  private static async queryNameservers(domain: string): Promise<string[]> {
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' }
      });

      if (!response.ok) return [];

      const data = await response.json();
      console.log('Nameservers Response:', data);

      if (data.Answer && data.Answer.length > 0) {
        return data.Answer.map((answer: any) => answer.data.replace(/\.$/, ''));
      }

      return [];
    } catch (error) {
      console.error('Error querying nameservers:', error);
      return [];
    }
  }

  /**
   * Detect provider from nameservers (améliorer la détection)
   */
  private static detectProvider(nameservers: string[]): string | null {
    const providerPatterns: Record<string, RegExp[]> = {
      'GoDaddy': [/godaddy/i, /domaincontrol/i],
      'Cloudflare': [/cloudflare/i],
      'OVH': [/ovh/i, /ovhcloud/i],
      'Gandi': [/gandi/i],
      'Namecheap': [/namecheap/i, /registrar-servers\.com/i],
      '1&1 IONOS': [/ionos/i, /1and1/i, /ui-dns/i],
      'Google Domains': [/google/i, /ns-cloud/i],
      'Name.com': [/name\.com/i],
      'DNSimple': [/dnsimple/i],
      'Hover': [/hover/i],
      'DreamHost': [/dreamhost/i],
      'HostGator': [/hostgator/i],
      'Bluehost': [/bluehost/i],
      'AWS Route 53': [/awsdns/i],
      'DigitalOcean': [/digitalocean/i],
      'Linode': [/linode/i],
      'Vultr': [/vultr/i]
    };

    for (const ns of nameservers) {
      const nsLower = ns.toLowerCase();

      for (const [provider, patterns] of Object.entries(providerPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(nsLower)) {
            return provider;
          }
        }
      }
    }

    return null;
  }

  /**
   * Tester plusieurs domaines à la fois
   */
  static async testMultipleDomains(domains: string[]) {
    console.log('🚀 Testing multiple domains...\n');

    const results = [];
    for (const domain of domains) {
      const result = await this.testDiscovery(domain);
      results.push(result);
      console.log('\n' + '='.repeat(60) + '\n');
    }

    return results;
  }

  /**
   * Tester la edge function directement (si déployée)
   */
  static async testEdgeFunction(domain: string, supabase: any) {
    console.group(`🧪 Testing Edge Function: ${domain}`);

    try {
      const { data, error } = await supabase.functions.invoke('domain-connect-discover', {
        body: { domain }
      });

      if (error) {
        console.error('❌ Edge Function Error:', error);
        return { success: false, error };
      }

      console.log('✅ Edge Function Response:', data);
      return data;
    } catch (error) {
      console.error('❌ Exception:', error);
      return { success: false, error };
    } finally {
      console.groupEnd();
    }
  }
}

// Export pour utilisation dans la console
if (typeof window !== 'undefined') {
  (window as any).DomainConnectDebugger = DomainConnectDebugger;
}

// Exemples d'utilisation dans la console:
// await DomainConnectDebugger.testDiscovery('example.com')
// await DomainConnectDebugger.testMultipleDomains(['google.com', 'github.com', 'vercel.com'])
// await DomainConnectDebugger.testEdgeFunction('example.com', supabase)
