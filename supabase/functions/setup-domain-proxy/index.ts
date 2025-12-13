import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Code du Worker Cloudflare
const WORKER_CODE = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Si c'est le domaine proxy lui-même, retourner une page d'info
    if (hostname === 'proxy.builtbymagellan.com') {
      return new Response(
        'Built by Magellan - Domain Proxy Service',
        {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }

    // Lookup du domaine dans KV
    const kvKey = 'domain:' + hostname;
    const projectName = await env.DOMAINS_KV.get(kvKey);

    if (!projectName) {
      return new Response(
        'Domain ' + hostname + ' is not configured. Please configure your domain in Built by Magellan dashboard.',
        {
          status: 404,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
          }
        }
      );
    }

    // Construire l'URL du site Cloudflare Pages
    const targetUrl = new URL(request.url);
    targetUrl.hostname = projectName + '.pages.dev';

    // Créer une nouvelle requête avec le nouveau hostname
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual'
    });

    // Proxy la requête
    try {
      const response = await fetch(modifiedRequest);
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set('X-Powered-By', 'Built by Magellan');
      modifiedResponse.headers.delete('X-Robots-Tag');
      return modifiedResponse;
    } catch (error) {
      console.error('Proxy error:', error);
      return new Response(
        'Error proxying request: ' + error.message,
        {
          status: 502,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }
  }
};
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
  const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
  const CLOUDFLARE_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID');
  let CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    return new Response(
      JSON.stringify({ success: false, message: 'Missing Cloudflare credentials' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results: string[] = [];

  try {
    // Étape 1: Créer ou vérifier le KV Namespace
    console.log('📦 Step 1: Checking/Creating KV Namespace...');
    
    if (!CLOUDFLARE_KV_NAMESPACE_ID || CLOUDFLARE_KV_NAMESPACE_ID === 'YOUR_KV_NAMESPACE_ID') {
      // Lister les namespaces existants
      const listResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const listData = await listResponse.json();
      console.log('KV Namespaces list:', JSON.stringify(listData));
      
      // Chercher si DOMAINS_KV existe déjà
      const existingNs = listData.result?.find((ns: any) => ns.title === 'domain-proxy-DOMAINS_KV');
      
      if (existingNs) {
        CLOUDFLARE_KV_NAMESPACE_ID = existingNs.id;
        results.push(`✅ KV Namespace exists: ${CLOUDFLARE_KV_NAMESPACE_ID}`);
      } else {
        // Créer le namespace
        const createResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: 'domain-proxy-DOMAINS_KV' }),
          }
        );
        
        const createData = await createResponse.json();
        console.log('KV Create response:', JSON.stringify(createData));
        
        if (createData.success && createData.result?.id) {
          CLOUDFLARE_KV_NAMESPACE_ID = createData.result.id;
          results.push(`✅ KV Namespace created: ${CLOUDFLARE_KV_NAMESPACE_ID}`);
        } else {
          results.push(`❌ Failed to create KV: ${JSON.stringify(createData.errors)}`);
        }
      }
    } else {
      results.push(`✅ Using existing KV Namespace: ${CLOUDFLARE_KV_NAMESPACE_ID}`);
    }

    // Étape 2: Déployer le Worker
    console.log('🚀 Step 2: Deploying Worker...');
    
    const workerFormData = new FormData();
    
    // Métadonnées du worker avec le binding KV
    const metadata = {
      main_module: 'worker.js',
      bindings: [
        {
          type: 'kv_namespace',
          name: 'DOMAINS_KV',
          namespace_id: CLOUDFLARE_KV_NAMESPACE_ID
        }
      ],
      compatibility_date: '2024-01-01'
    };
    
    workerFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    workerFormData.append('worker.js', new Blob([WORKER_CODE], { type: 'application/javascript+module' }), 'worker.js');
    
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/domain-proxy`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: workerFormData,
      }
    );
    
    const deployData = await deployResponse.json();
    console.log('Worker deploy response:', JSON.stringify(deployData));
    
    if (deployData.success) {
      results.push('✅ Worker deployed successfully');
    } else {
      results.push(`❌ Worker deploy failed: ${JSON.stringify(deployData.errors)}`);
    }

    // Étape 3: Configurer le Custom Domain (proxy.builtbymagellan.com)
    console.log('🌐 Step 3: Configuring custom domain...');
    
    // D'abord, vérifier si le domaine existe déjà
    const domainsListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const domainsList = await domainsListResponse.json();
    console.log('Workers domains list:', JSON.stringify(domainsList));
    
    const existingDomain = domainsList.result?.find((d: any) => d.hostname === 'proxy.builtbymagellan.com');
    
    if (existingDomain) {
      results.push('✅ Custom domain already configured: proxy.builtbymagellan.com');
    } else {
      // Ajouter le custom domain
      const domainResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hostname: 'proxy.builtbymagellan.com',
            service: 'domain-proxy',
            environment: 'production',
            zone_id: CLOUDFLARE_ZONE_ID
          }),
        }
      );
      
      const domainData = await domainResponse.json();
      console.log('Custom domain response:', JSON.stringify(domainData));
      
      if (domainData.success) {
        results.push('✅ Custom domain configured: proxy.builtbymagellan.com');
      } else {
        results.push(`⚠️ Custom domain setup: ${JSON.stringify(domainData.errors || domainData.messages)}`);
        
        // Alternative: créer une route Workers
        console.log('Trying Workers route as fallback...');
        const routeResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/workers/routes`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pattern: 'proxy.builtbymagellan.com/*',
              script: 'domain-proxy'
            }),
          }
        );
        
        const routeData = await routeResponse.json();
        console.log('Route response:', JSON.stringify(routeData));
        
        if (routeData.success) {
          results.push('✅ Workers route created as fallback');
        } else {
          results.push(`⚠️ Route creation: ${JSON.stringify(routeData.errors)}`);
        }
      }
    }

    // Étape 4: Test du KV avec une entrée de test
    console.log('🧪 Step 4: Testing KV...');
    
    if (CLOUDFLARE_KV_NAMESPACE_ID) {
      const testKey = 'domain:test.example.com';
      const testValue = 'test-project-name';
      
      const kvWriteResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(testKey)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: testValue,
        }
      );
      
      if (kvWriteResponse.ok) {
        results.push('✅ KV write test passed');
        
        // Lire pour vérifier
        const kvReadResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(testKey)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            },
          }
        );
        
        const readValue = await kvReadResponse.text();
        if (readValue === testValue) {
          results.push('✅ KV read test passed');
        } else {
          results.push(`⚠️ KV read mismatch: expected "${testValue}", got "${readValue}"`);
        }
      } else {
        results.push(`❌ KV write test failed: ${await kvWriteResponse.text()}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        kvNamespaceId: CLOUDFLARE_KV_NAMESPACE_ID,
        results,
        message: 'Domain proxy setup completed. Check results for details.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Setup error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        results
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
