/**
 * Domain Connect Verification Service
 * Vérifie que les DNS sont correctement configurés
 */

export interface DNSVerificationResult {
  configured: boolean;
  apexConfigured: boolean;
  wwwConfigured: boolean;
  status: 'pending' | 'partial' | 'complete' | 'error';
  message?: string;
  records?: {
    apex?: string[];
    www?: string[];
  };
}

export class DomainConnectVerification {
  private readonly expectedTarget = 'proxy.builtbymagellan.com';
  private readonly maxAttempts = 60; // 10 minutes (10s interval)
  private readonly pollInterval = 10000; // 10 seconds

  /**
   * Vérifie les DNS via DNS-over-HTTPS (Cloudflare)
   * Fonctionne côté client (browser)
   */
  async verifyDNS(domain: string): Promise<DNSVerificationResult> {
    try {
      // Vérifier CNAME apex (@)
      const apexRecords = await this.queryCNAME(domain);
      const apexConfigured = this.isValidTarget(apexRecords);

      // Vérifier CNAME www
      const wwwRecords = await this.queryCNAME(`www.${domain}`);
      const wwwConfigured = this.isValidTarget(wwwRecords);

      const configured = apexConfigured && wwwConfigured;
      let status: 'pending' | 'partial' | 'complete' | 'error' = 'pending';

      if (configured) {
        status = 'complete';
      } else if (apexConfigured || wwwConfigured) {
        status = 'partial';
      }

      return {
        configured,
        apexConfigured,
        wwwConfigured,
        status,
        records: {
          apex: apexRecords,
          www: wwwRecords
        },
        message: configured
          ? 'DNS correctement configuré'
          : apexConfigured || wwwConfigured
          ? 'Configuration partielle détectée'
          : 'Aucune configuration DNS détectée'
      };
    } catch (error) {
      console.error('[Verification] DNS query error:', error);
      return {
        configured: false,
        apexConfigured: false,
        wwwConfigured: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la vérification DNS'
      };
    }
  }

  /**
   * Polling DNS avec retry
   * Continue jusqu'à succès ou timeout
   */
  async pollDNS(
    domain: string,
    onProgress?: (result: DNSVerificationResult) => void
  ): Promise<DNSVerificationResult> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const result = await this.verifyDNS(domain);

      if (onProgress) {
        onProgress(result);
      }

      if (result.configured) {
        return result;
      }

      // Attendre avant le prochain essai (sauf au dernier)
      if (attempt < this.maxAttempts - 1) {
        await this.sleep(this.pollInterval);
      }
    }

    // Timeout
    const finalResult = await this.verifyDNS(domain);
    return {
      ...finalResult,
      status: 'error',
      message: 'Timeout: DNS non configuré après 10 minutes'
    };
  }

  /**
   * Query CNAME via DNS-over-HTTPS (Cloudflare)
   */
  private async queryCNAME(hostname: string): Promise<string[]> {
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (data.Answer && data.Answer.length > 0) {
        // Extraire les valeurs CNAME
        return data.Answer.map((answer: any) => {
          // Enlever le point final si présent
          return answer.data.replace(/\.$/, '');
        });
      }

      return [];
    } catch (error) {
      console.error('[Verification] CNAME query error:', error);
      return [];
    }
  }

  /**
   * Vérifie si les records pointent vers notre target
   */
  private isValidTarget(records: string[]): boolean {
    return records.some(record =>
      record.toLowerCase() === this.expectedTarget.toLowerCase()
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtenir un message de progression user-friendly
   */
  getProgressMessage(attempt: number, maxAttempts: number): string {
    const progress = Math.round((attempt / maxAttempts) * 100);
    const elapsed = Math.round((attempt * this.pollInterval) / 1000);

    return `Vérification en cours... ${progress}% (${elapsed}s écoulées)`;
  }
}
