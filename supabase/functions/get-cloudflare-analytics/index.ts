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
      .select('cloudflare_project_name, title')
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
    const CLOUDFLARE_EMAIL = Deno.env.get('CLOUDFLARE_EMAIL');
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_EMAIL || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Cloudflare credentials not configured');
    }

    console.log(`📊 Fetching Worker analytics for ${session.cloudflare_project_name}`);

    // Calculer les dates pour la période demandée
    const now = new Date();
    const endTime = now.toISOString();
    let startTime: string;
    
    switch (period) {
      case '1d':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }

    console.log(`📅 Period: ${startTime} to ${endTime}`);

    // Utiliser l'API Workers Analytics avec GraphQL
    const graphqlQuery = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            workersInvocationsAdaptive(
              filter: {
                datetime_geq: "${startTime}"
                datetime_leq: "${endTime}"
                scriptName: "${session.cloudflare_project_name}"
              }
              limit: 10000
            ) {
              dimensions {
                datetime
                scriptName
              }
              sum {
                requests
                errors
                subrequests
              }
              quantiles {
                cpuTimeP50
                cpuTimeP99
              }
            }
          }
        }
      }
    `;

    console.log('🔄 Calling Cloudflare GraphQL API...');
    
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cloudflare API error:', errorText);
      throw new Error(`Cloudflare API error: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ Response received from Cloudflare');

    if (responseData.errors && responseData.errors.length > 0) {
      console.error('❌ GraphQL errors:', JSON.stringify(responseData.errors));
      throw new Error(`GraphQL error: ${responseData.errors[0].message}`);
    }

    const workerData = responseData.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];

    if (workerData.length === 0) {
      console.log('⚠️ No analytics data found for this Worker');
      // Retourner des données vides mais valides
      return new Response(
        JSON.stringify({
          timeSeries: [],
          metrics: {
            visitors: 0,
            pageviews: 0,
            viewsPerVisit: 0,
            visitDuration: 0,
            bounceRate: 0,
          },
          lists: {
            sources: [],
            pages: [],
            countries: [],
            devices: [],
          },
          last_updated: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transformer les données Worker en format analytics
    const timeSeriesMap = new Map<string, { requests: number; errors: number }>();
    
    workerData.forEach((item: any) => {
      const date = item.dimensions.datetime.split('T')[0]; // Extraire la date YYYY-MM-DD
      const existing = timeSeriesMap.get(date) || { requests: 0, errors: 0 };
      timeSeriesMap.set(date, {
        requests: existing.requests + (item.sum.requests || 0),
        errors: existing.errors + (item.sum.errors || 0),
      });
    });

    const timeSeries = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        visitors: data.requests, // Utiliser les requêtes comme proxy pour les visiteurs
        pageviews: data.requests,
        requests: data.requests,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculer les métriques totales
    const totalRequests = workerData.reduce((sum: number, item: any) => sum + (item.sum.requests || 0), 0);
    const totalErrors = workerData.reduce((sum: number, item: any) => sum + (item.sum.errors || 0), 0);
    const avgCpuTime = workerData.reduce((sum: number, item: any) => sum + (item.quantiles?.cpuTimeP50 || 0), 0) / workerData.length;

    // Estimer le taux de rebond basé sur les erreurs
    const bounceRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0;

    console.log(`📈 Processed ${workerData.length} data points`);
    console.log(`📊 Total requests: ${totalRequests}, Errors: ${totalErrors}`);

    const result = {
      timeSeries,
      metrics: {
        visitors: totalRequests,
        pageviews: totalRequests,
        viewsPerVisit: 1, // Workers n'ont pas cette métrique
        visitDuration: Math.round(avgCpuTime / 1000), // Convertir µs en secondes
        bounceRate,
      },
      lists: {
        sources: [{ label: 'Direct', value: totalRequests }], // Workers n'ont pas le referer
        pages: [{ label: '/', value: totalRequests }], // Workers n'ont pas les paths individuels par défaut
        countries: [], // Nécessite une requête GraphQL supplémentaire
        devices: [], // Nécessite une requête GraphQL supplémentaire
      },
      last_updated: new Date().toISOString(),
    };

    console.log('✅ Analytics data successfully processed');

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in get-cloudflare-analytics function:', error);
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
