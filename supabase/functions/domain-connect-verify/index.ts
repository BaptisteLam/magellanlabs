import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, sessionId } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, message: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedTarget = 'proxy.builtbymagellan.com';

    // Vérifier CNAME apex (@)
    const apexRecords = await queryCNAME(domain);
    const apexConfigured = isValidTarget(apexRecords, expectedTarget);

    // Vérifier CNAME www
    const wwwRecords = await queryCNAME(`www.${domain}`);
    const wwwConfigured = isValidTarget(wwwRecords, expectedTarget);

    const configured = apexConfigured && wwwConfigured;
    let status: 'pending' | 'partial' | 'complete' | 'error' = 'pending';

    if (configured) {
      status = 'complete';
    } else if (apexConfigured || wwwConfigured) {
      status = 'partial';
    }

    const result = {
      success: true,
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

    // Si configuré et sessionId fourni, mettre à jour la session
    if (configured && sessionId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Obtenir le projectName depuis la session
      const { data: session } = await supabase
        .from('build_sessions')
        .select('cloudflare_project_name, user_id')
        .eq('id', sessionId)
        .single();

      if (session?.cloudflare_project_name) {
        // Ajouter le domaine à Cloudflare Pages via la fonction existante
        const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
        const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

        if (CLOUDFLARE_API_TOKEN && CLOUDFLARE_ACCOUNT_ID) {
          try {
            const addDomainResponse = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${session.cloudflare_project_name}/domains`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: domain }),
              }
            );

            if (addDomainResponse.ok) {
              // Ajouter le mapping dans Cloudflare KV pour le proxy
              const KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
              
              if (KV_NAMESPACE_ID && session.cloudflare_project_name) {
                try {
                  const kvKey = `domain:${domain}`;
                  const kvValue = session.cloudflare_project_name;
                  
                  const kvResponse = await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(kvKey)}`,
                    {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                        'Content-Type': 'text/plain',
                      },
                      body: kvValue,
                    }
                  );
                  
                  if (kvResponse.ok) {
                    console.log('✅ Domain mapping added to KV:', kvKey, '->', kvValue);
                  } else {
                    console.error('❌ Failed to add domain to KV:', await kvResponse.text());
                  }
                } catch (kvError) {
                  console.error('KV write error:', kvError);
                }
              }
              
              // Mettre à jour la session avec le domaine personnalisé
              await supabase
                .from('build_sessions')
                .update({ public_url: `https://${domain}` })
                .eq('id', sessionId);

              console.log('✅ Domain added to Cloudflare Pages:', domain);
            }
          } catch (error) {
            console.error('Error adding domain to Cloudflare:', error);
          }
        }
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in domain-connect-verify:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function queryCNAME(hostname: string): Promise<string[]> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (data.Answer && data.Answer.length > 0) {
      return data.Answer.map((answer: any) => answer.data.replace(/\.$/, ''));
    }

    return [];
  } catch (error) {
    console.error('[Verification] CNAME query error:', error);
    return [];
  }
}

function isValidTarget(records: string[], expectedTarget: string): boolean {
  return records.some(record =>
    record.toLowerCase() === expectedTarget.toLowerCase()
  );
}
