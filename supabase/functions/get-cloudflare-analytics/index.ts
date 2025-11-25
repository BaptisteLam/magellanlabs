import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AnalyticsRequest {
  session_id: string;
  period: '1d' | '7d' | '30d';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'authentification
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { session_id, period }: AnalyticsRequest = await req.json();
    
    if (!session_id || !period) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les informations du projet
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('cloudflare_project_name')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session?.cloudflare_project_name) {
      return new Response(
        JSON.stringify({ error: 'Project not deployed to Cloudflare or not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Calculer les dates
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📊 Fetching analytics for ${session.cloudflare_project_name} from ${startDateStr} to ${endDateStr}`);

    // Requêtes GraphQL à l'API Cloudflare Analytics pour récupérer TOUTES les données
    
    // 1. Données de base (visitors, pageviews par jour)
    const baseQuery = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            httpRequests1dGroups(
              filter: {
                date_geq: "${startDateStr}"
                date_leq: "${endDateStr}"
              }
              limit: 1000
            ) {
              dimensions {
                date
              }
              sum {
                requests
                pageViews
                visits
              }
              uniq {
                uniques
              }
            }
          }
        }
      }
    `;

    // 2. Données par pays
    const countryQuery = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            httpRequests1dGroups(
              filter: {
                date_geq: "${startDateStr}"
                date_leq: "${endDateStr}"
              }
              limit: 1000
            ) {
              dimensions {
                date
                clientCountryName
              }
              sum {
                visits
              }
            }
          }
        }
      }
    `;

    // 3. Données par page
    const pageQuery = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            httpRequests1dGroups(
              filter: {
                date_geq: "${startDateStr}"
                date_leq: "${endDateStr}"
              }
              limit: 1000
            ) {
              dimensions {
                date
                clientRequestPath
              }
              sum {
                visits
              }
            }
          }
        }
      }
    `;

    // 4. Données par device
    const deviceQuery = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            httpRequests1dGroups(
              filter: {
                date_geq: "${startDateStr}"
                date_leq: "${endDateStr}"
              }
              limit: 1000
            ) {
              dimensions {
                date
                clientDeviceType
              }
              sum {
                visits
              }
            }
          }
        }
      }
    `;

    // 5. Données par referer (sources)
    const refererQuery = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            httpRequests1dGroups(
              filter: {
                date_geq: "${startDateStr}"
                date_leq: "${endDateStr}"
              }
              limit: 1000
            ) {
              dimensions {
                date
                clientRequestHTTPReferer
              }
              sum {
                visits
              }
            }
          }
        }
      }
    `;

    console.log('🔄 Fetching base analytics...');
    const baseResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: baseQuery }),
    });

    if (!baseResponse.ok) {
      const error = await baseResponse.text();
      console.error('❌ Cloudflare API error:', error);
      throw new Error(`Cloudflare API error: ${error}`);
    }

    const baseData = await baseResponse.json();
    console.log('✅ Base analytics received');

    // Récupérer les données par pays
    console.log('🔄 Fetching country analytics...');
    const countryResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: countryQuery }),
    });
    const countryData = countryResponse.ok ? await countryResponse.json() : { data: { viewer: { accounts: [{ httpRequests1dGroups: [] }] } } };

    // Récupérer les données par page
    console.log('🔄 Fetching page analytics...');
    const pageResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: pageQuery }),
    });
    const pageData = pageResponse.ok ? await pageResponse.json() : { data: { viewer: { accounts: [{ httpRequests1dGroups: [] }] } } };

    // Récupérer les données par device
    console.log('🔄 Fetching device analytics...');
    const deviceResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deviceQuery }),
    });
    const deviceData = deviceResponse.ok ? await deviceResponse.json() : { data: { viewer: { accounts: [{ httpRequests1dGroups: [] }] } } };

    // Récupérer les données par referer
    console.log('🔄 Fetching referer analytics...');
    const refererResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: refererQuery }),
    });
    const refererData = refererResponse.ok ? await refererResponse.json() : { data: { viewer: { accounts: [{ httpRequests1dGroups: [] }] } } };

    const groups = baseData.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];

    // Transformer les données de base
    const timeSeriesData = groups.map((group: any) => ({
      date: group.dimensions.date,
      visitors: group.uniq.uniques,
      pageviews: group.sum.pageViews,
      requests: group.sum.requests,
    }));

    const totalVisitors = groups.reduce((sum: number, g: any) => sum + g.uniq.uniques, 0);
    const totalPageviews = groups.reduce((sum: number, g: any) => sum + g.sum.pageViews, 0);
    const totalVisits = groups.reduce((sum: number, g: any) => sum + (g.sum.visits || 0), 0);
    const avgViewsPerVisit = totalVisitors > 0 ? (totalPageviews / totalVisitors).toFixed(2) : '0';

    // Traiter les données par pays
    const countryGroups = countryData.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];
    const countryMap = new Map<string, number>();
    countryGroups.forEach((group: any) => {
      const country = group.dimensions.clientCountryName || 'Unknown';
      const visits = group.sum.visits || 0;
      countryMap.set(country, (countryMap.get(country) || 0) + visits);
    });
    const by_countries = Array.from(countryMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Traiter les données par page
    const pageGroups = pageData.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];
    const pageMap = new Map<string, number>();
    pageGroups.forEach((group: any) => {
      const page = group.dimensions.clientRequestPath || '/';
      const visits = group.sum.visits || 0;
      pageMap.set(page, (pageMap.get(page) || 0) + visits);
    });
    const by_pages = Array.from(pageMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Traiter les données par device
    const deviceGroups = deviceData.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];
    const deviceMap = new Map<string, number>();
    const totalDeviceVisits = deviceGroups.reduce((sum: number, g: any) => sum + (g.sum.visits || 0), 0);
    deviceGroups.forEach((group: any) => {
      const device = group.dimensions.clientDeviceType || 'Unknown';
      const visits = group.sum.visits || 0;
      deviceMap.set(device, (deviceMap.get(device) || 0) + visits);
    });
    const by_devices = Array.from(deviceMap.entries())
      .map(([label, value]) => ({ 
        label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), 
        value: totalDeviceVisits > 0 ? parseFloat(((value / totalDeviceVisits) * 100).toFixed(1)) : 0 
      }))
      .sort((a, b) => b.value - a.value);

    // Traiter les données par referer (sources)
    const refererGroups = refererData.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];
    const refererMap = new Map<string, number>();
    refererGroups.forEach((group: any) => {
      let referer = group.dimensions.clientRequestHTTPReferer || 'Direct';
      if (referer && referer !== 'Direct') {
        try {
          const url = new URL(referer);
          referer = url.hostname.replace('www.', '');
        } catch {
          // Si l'URL n'est pas valide, garder telle quelle
        }
      }
      const visits = group.sum.visits || 0;
      refererMap.set(referer, (refererMap.get(referer) || 0) + visits);
    });
    const by_sources = Array.from(refererMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    console.log('✅ All analytics data processed');

    const result = {
      timeSeries: timeSeriesData,
      metrics: {
        visitors: totalVisitors,
        pageviews: totalPageviews,
        viewsPerVisit: parseFloat(avgViewsPerVisit),
        visitDuration: 0, // Non disponible dans l'API GraphQL standard
        bounceRate: 0, // Non disponible dans l'API GraphQL standard
      },
      lists: {
        sources: by_sources,
        pages: by_pages,
        countries: by_countries,
        devices: by_devices,
      },
      last_updated: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in get-cloudflare-analytics function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
