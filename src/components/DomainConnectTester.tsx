import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DomainConnectDebugger } from '@/lib/domain-connect/debugger';
import { supabase } from '@/integrations/supabase/client';

/**
 * Composant de test pour Domain Connect
 * À utiliser temporairement pour debugger la détection de provider
 *
 * Usage: Ajouter ce composant dans Dashboard ou n'importe où
 * <DomainConnectTester />
 */
export function DomainConnectTester() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLocal = async () => {
    if (!domain) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await DomainConnectDebugger.testDiscovery(domain);
      setResult(res);
    } catch (error) {
      console.error(error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const testEdgeFunction = async () => {
    if (!domain) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await DomainConnectDebugger.testEdgeFunction(domain, supabase);
      setResult(res);
    } catch (error) {
      console.error(error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>🧪 Domain Connect Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter a domain (e.g. google.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && testLocal()}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={testLocal}
            disabled={loading || !domain}
            variant="outline"
          >
            🔍 Test Local (Browser)
          </Button>
          <Button
            onClick={testEdgeFunction}
            disabled={loading || !domain}
            variant="outline"
          >
            ☁️ Test Edge Function
          </Button>
        </div>

        {loading && (
          <div className="p-4 bg-blue-50 rounded">
            Analyzing...
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="font-semibold">Result:</div>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>

            {result.provider && (
              <div className="p-4 bg-green-50 rounded">
                Provider detected: <strong>{result.provider}</strong>
              </div>
            )}

            {result.providerName && (
              <div className="p-4 bg-green-50 rounded">
                ✅ Provider: <strong>{result.providerName}</strong>
              </div>
            )}

            {result.nameservers && (
              <div className="p-4 bg-gray-50 rounded">
                <div className="font-semibold mb-2">Nameservers:</div>
                <ul className="list-disc list-inside">
                  {result.nameservers.map((ns: string, i: number) => (
                    <li key={i} className="text-sm">{ns}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.error && (
              <div className="p-4 bg-red-50 rounded text-red-700">
                Error: {result.error}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t text-xs text-gray-500">
          <p><strong>Test Local:</strong> Teste la détection côté browser (ouvre la console pour voir les logs)</p>
          <p><strong>Test Edge Function:</strong> Teste la edge function Supabase (nécessite qu'elle soit déployée)</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Exemples de domaines à tester:
// - google.com (Google Domains / ns-cloud)
// - github.com (AWS Route 53 / awsdns)
// - vercel.com (Cloudflare)
// - ovh.com (OVH)
