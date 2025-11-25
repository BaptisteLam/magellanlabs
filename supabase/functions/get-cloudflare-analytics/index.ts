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

    // Requête GraphQL à l'API Cloudflare Analytics
    const graphqlQuery = `
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
              }
              uniq {
                uniques
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Cloudflare API error:', error);
      throw new Error(`Cloudflare API error: ${error}`);
    }

    const analyticsData = await response.json();
    console.log('✅ Analytics data received');

    const groups = analyticsData.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];

    // Transformer les données
    const timeSeriesData = groups.map((group: any) => ({
      date: group.dimensions.date,
      visitors: group.uniq.uniques,
      pageviews: group.sum.pageViews,
      requests: group.sum.requests,
    }));

    const totalVisitors = groups.reduce((sum: number, g: any) => sum + g.uniq.uniques, 0);
    const totalPageviews = groups.reduce((sum: number, g: any) => sum + g.sum.pageViews, 0);
    const avgViewsPerVisit = totalVisitors > 0 ? (totalPageviews / totalVisitors).toFixed(2) : '0';

    // Pour ces métriques, on va créer des données fictives pour l'instant
    // car Cloudflare Web Analytics ne fournit pas ces détails par défaut
    const result = {
      timeSeries: timeSeriesData,
      metrics: {
        visitors: totalVisitors,
        pageviews: totalPageviews,
        viewsPerVisit: parseFloat(avgViewsPerVisit),
        visitDuration: 0, // Non disponible dans l'API de base
        bounceRate: 0, // Non disponible dans l'API de base
      },
      lists: {
        sources: [],
        pages: [],
        countries: [],
        devices: [],
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
