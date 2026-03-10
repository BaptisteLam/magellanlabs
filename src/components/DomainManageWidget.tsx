import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Globe, AlertCircle, RefreshCw, ExternalLink, Loader2, Shield, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DomainManageWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  cloudflareProjectName?: string;
  /** Anchor position for the floating widget */
  position?: 'center' | 'top-right';
}

interface DomainInfo {
  domain: string;
  status: 'pending' | 'active' | 'failed';
  dns_verified: boolean;
  method: string;
  provider_name: string | null;
  created_at: string;
  verified_at: string | null;
  last_checked_at: string | null;
}

interface DnsCheckResult {
  apexConfigured: boolean;
  wwwConfigured: boolean;
  status: 'pending' | 'partial' | 'complete' | 'error';
  message: string;
}

const DNS_RECORDS = {
  apex: {
    type: 'A',
    name: '@',
    value: '185.158.133.1',
    ttl: '3600',
    description: 'Root domain (apex) - Points to Magellan proxy',
  },
  www: {
    type: 'CNAME',
    name: 'www',
    value: 'proxy.builtbymagellan.com',
    ttl: '3600',
    description: 'WWW subdomain - Points to Magellan proxy',
  },
};

export function DomainManageWidget({
  open,
  onOpenChange,
  sessionId,
  cloudflareProjectName,
  position = 'center',
}: DomainManageWidgetProps) {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<Record<string, DnsCheckResult>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_domains')
        .select('domain, status, dns_verified, method, provider_name, created_at, verified_at, last_checked_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (err) {
      console.error('Error fetching domains:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      fetchDomains();
    }
  }, [open, fetchDomains]);

  const checkDns = async (domain: string) => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('domain-connect-verify', {
        body: { domain, sessionId },
      });

      if (error) throw error;

      setDnsStatus(prev => ({
        ...prev,
        [domain]: {
          apexConfigured: data.apexConfigured,
          wwwConfigured: data.wwwConfigured,
          status: data.status,
          message: data.message,
        },
      }));

      // If now complete, refresh domain list
      if (data.status === 'complete') {
        await fetchDomains();
        toast.success('Domain is fully configured!');
      }
    } catch (err) {
      console.error('DNS check error:', err);
      toast.error('Error checking DNS');
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusColor = (domain: DomainInfo) => {
    const dns = dnsStatus[domain.domain];
    if (domain.status === 'active' && domain.dns_verified) return 'bg-green-500';
    if (dns?.status === 'partial') return 'bg-orange-500';
    if (dns?.status === 'complete') return 'bg-green-500';
    return 'bg-orange-500';
  };

  const getStatusText = (domain: DomainInfo) => {
    const dns = dnsStatus[domain.domain];
    if (domain.status === 'active' && domain.dns_verified) return 'Active';
    if (dns?.status === 'complete') return 'Active';
    if (dns?.status === 'partial') return 'Partial';
    return 'Pending';
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Floating Widget */}
      <div
        className={cn(
          'fixed z-50 w-[520px] max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl border',
          'bg-[#1a1a1b] border-[#3a3a3b] text-foreground',
          position === 'center' && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          position === 'top-right' && 'top-20 right-8'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#3a3a3b]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(3,165,192,0.15)' }}
            >
              <Globe className="h-5 w-5" style={{ color: '#03A5C0' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Domain Management</h2>
              <p className="text-xs text-muted-foreground">Configure your custom domain</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#2a2a2b] transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#03A5C0' }} />
            </div>
          ) : domains.length === 0 ? (
            /* No domain connected yet - show DNS instructions */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#242425] border border-[#3a3a3b]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">No custom domain connected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the "Connect" button in your domain settings to add a custom domain first.
                    </p>
                  </div>
                </div>
              </div>

              {/* Show DNS records for reference */}
              <DnsRecordsGuide onCopy={copyToClipboard} copiedField={copiedField} />
            </div>
          ) : (
            /* Connected domains */
            <div className="space-y-5">
              {domains.map((domain) => (
                <div key={domain.domain} className="space-y-4">
                  {/* Domain status card */}
                  <div className="p-4 rounded-xl bg-[#242425] border border-[#3a3a3b]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-3 h-3 rounded-full', getStatusColor(domain))} />
                        <span className="text-base font-semibold text-white font-mono">
                          {domain.domain}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium px-2.5 py-1 rounded-full',
                          getStatusText(domain) === 'Active'
                            ? 'bg-green-500/15 text-green-400'
                            : getStatusText(domain) === 'Partial'
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                        )}
                      >
                        {getStatusText(domain)}
                      </span>
                    </div>

                    {/* DNS check results */}
                    {dnsStatus[domain.domain] && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a1b]">
                          {dnsStatus[domain.domain].apexConfigured ? (
                            <Wifi className="h-4 w-4 text-green-400" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-orange-400" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            Root (A): {dnsStatus[domain.domain].apexConfigured ? 'OK' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a1b]">
                          {dnsStatus[domain.domain].wwwConfigured ? (
                            <Wifi className="h-4 w-4 text-green-400" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-orange-400" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            WWW (CNAME): {dnsStatus[domain.domain].wwwConfigured ? 'OK' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => checkDns(domain.domain)}
                        disabled={isChecking}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all"
                        style={{
                          borderColor: 'rgba(3,165,192,0.4)',
                          color: '#03A5C0',
                          backgroundColor: 'rgba(3,165,192,0.08)',
                        }}
                      >
                        {isChecking ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Check DNS
                      </button>

                      {(domain.status === 'active' || dnsStatus[domain.domain]?.status === 'complete') && (
                        <a
                          href={`https://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all border-[#3a3a3b] text-muted-foreground hover:text-white"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Visit
                        </a>
                      )}
                    </div>
                  </div>

                  {/* SSL info */}
                  {(domain.status === 'active' || dnsStatus[domain.domain]?.status === 'complete') && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-300">
                        SSL certificate automatically provisioned by Cloudflare
                      </span>
                    </div>
                  )}

                  {/* Show DNS guide if not fully configured */}
                  {domain.status !== 'active' && dnsStatus[domain.domain]?.status !== 'complete' && (
                    <DnsRecordsGuide onCopy={copyToClipboard} copiedField={copiedField} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* How it works section */}
          <div className="p-4 rounded-xl bg-[#242425] border border-[#3a3a3b]">
            <h3 className="text-sm font-semibold text-white mb-3">How it works</h3>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-white flex-shrink-0">1.</span>
                Go to your <span className="font-medium text-white">domain registrar</span> (OVH, Namecheap, GoDaddy, Ionos, etc.)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-white flex-shrink-0">2.</span>
                Navigate to <span className="font-medium text-white">DNS management</span> of your domain
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-white flex-shrink-0">3.</span>
                Add the 2 DNS records shown above (A record + CNAME)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-white flex-shrink-0">4.</span>
                Wait for DNS propagation (2 to 30 minutes typically)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-white flex-shrink-0">5.</span>
                Click <span className="font-medium text-white">"Check DNS"</span> to verify the configuration
              </li>
            </ol>
          </div>

          {/* Important notes */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300 space-y-1">
                <p className="font-medium">Important notes:</p>
                <ul className="space-y-0.5 text-blue-200/80">
                  <li>DNS propagation can take up to 24h in rare cases</li>
                  <li>If using Cloudflare for your domain, disable the proxy (orange cloud) for the CNAME</li>
                  <li>SSL is automatically provided - no manual certificate needed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** DNS Records guide sub-component */
function DnsRecordsGuide({
  onCopy,
  copiedField,
}: {
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">DNS records to configure</h3>

      {/* A Record */}
      <div className="p-4 rounded-xl bg-[#181818] border border-[#3a3a3b]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400">
            {DNS_RECORDS.apex.type}
          </span>
          <span className="text-xs text-muted-foreground">{DNS_RECORDS.apex.description}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">Name</span>
            <div className="text-sm font-mono text-white">{DNS_RECORDS.apex.name}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">Value</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono text-white">{DNS_RECORDS.apex.value}</span>
              <button
                onClick={() => onCopy(DNS_RECORDS.apex.value, 'apex-value')}
                className="p-1 hover:bg-[#2a2a2b] rounded transition-colors"
              >
                {copiedField === 'apex-value' ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">TTL</span>
            <div className="text-sm font-mono text-muted-foreground">{DNS_RECORDS.apex.ttl}</div>
          </div>
        </div>
      </div>

      {/* CNAME Record */}
      <div className="p-4 rounded-xl bg-[#181818] border border-[#3a3a3b]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(3,165,192,0.2)', color: '#03A5C0' }}>
            {DNS_RECORDS.www.type}
          </span>
          <span className="text-xs text-muted-foreground">{DNS_RECORDS.www.description}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">Name</span>
            <div className="text-sm font-mono text-white">{DNS_RECORDS.www.name}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">Value</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono text-white break-all">{DNS_RECORDS.www.value}</span>
              <button
                onClick={() => onCopy(DNS_RECORDS.www.value, 'www-value')}
                className="p-1 hover:bg-[#2a2a2b] rounded transition-colors flex-shrink-0"
              >
                {copiedField === 'www-value' ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">TTL</span>
            <div className="text-sm font-mono text-muted-foreground">{DNS_RECORDS.www.ttl}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
