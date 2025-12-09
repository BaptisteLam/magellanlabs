import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  session_id: string;
  period: '1d' | '7d' | '30d';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { session_id, period }: AnalyticsRequest = await req.json();

    // Get project details including Web Analytics site token
    const { data: session, error: sessionError } = await supabase
      .from('build_sessions')
      .select('web_analytics_site_token, cloudflare_project_name')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const siteToken = session.web_analytics_site_token;
    if (!siteToken) {
      // No analytics configured yet - return empty data
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
          message: 'Analytics non configuré pour ce projet. Publiez votre projet pour activer les analytics.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (period === '1d') {
      startDate.setDate(endDate.getDate() - 1);
    } else if (period === '7d') {
      startDate.setDate(endDate.getDate() - 7);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!cloudflareApiToken || !cloudflareAccountId) {
      throw new Error('Missing Cloudflare credentials');
    }

    console.log('📊 Fetching analytics for:', {
      siteToken,
      accountId: cloudflareAccountId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      period
    });

    // Use Cloudflare GraphQL API for Web Analytics (RUM)
    const graphqlQuery = `
      query GetRumAnalytics($accountTag: String!, $siteTag: String!, $since: String!, $until: String!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            rumPageloadEventsAdaptiveGroups(
              filter: { siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until }
              limit: 1000
              orderBy: [datetime_ASC]
            ) {
              count
              dimensions {
                datetime
                countryName
                deviceType
                path
                refererHost
              }
              sum {
                visits
              }
            }
          }
        }
      }
    `;

    console.log('📊 Fetching analytics via GraphQL...');
    
    const graphqlResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          accountTag: cloudflareAccountId,
          siteTag: siteToken,
          since: startDate.toISOString(),
          until: endDate.toISOString(),
        },
      }),
    });

    if (!graphqlResponse.ok) {
      const errorText = await graphqlResponse.text();
      console.error('❌ GraphQL request failed:', errorText);
      
      // Return empty data with message instead of error
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
          message: 'Les données analytics peuvent prendre 24-48h à apparaître après la première publication.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const graphqlData = await graphqlResponse.json();
    console.log('📊 GraphQL response received');

    // Check for GraphQL errors
    if (graphqlData.errors && graphqlData.errors.length > 0) {
      console.error('❌ GraphQL errors:', graphqlData.errors);
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
          message: 'Les données analytics peuvent prendre 24-48h à apparaître après la première publication.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const events = graphqlData.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
    
    if (events.length === 0) {
      console.log('📊 No analytics data found yet');
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
          message: 'Aucune donnée disponible. Les analytics apparaîtront après les premières visites.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processing ${events.length} analytics events`);

    // Process time series data
    const timeSeriesMap = new Map<string, { visitors: number; pageviews: number }>();
    const pagesMap = new Map<string, number>();
    const countriesMap = new Map<string, number>();
    const devicesMap = new Map<string, number>();
    const sourcesMap = new Map<string, number>();
    
    let totalVisitors = 0;
    let totalPageviews = 0;

    events.forEach((event: any) => {
      const date = event.dimensions?.datetime?.split('T')[0] || new Date().toISOString().split('T')[0];
      const visits = event.sum?.visits || 0;
      const pageviews = event.count || 0;
      
      totalVisitors += visits;
      totalPageviews += pageviews;

      // Time series
      const existing = timeSeriesMap.get(date) || { visitors: 0, pageviews: 0 };
      timeSeriesMap.set(date, {
        visitors: existing.visitors + visits,
        pageviews: existing.pageviews + pageviews,
      });

      // Pages
      const path = event.dimensions?.path || '/';
      pagesMap.set(path, (pagesMap.get(path) || 0) + pageviews);

      // Countries
      const country = event.dimensions?.countryName || 'Unknown';
      countriesMap.set(country, (countriesMap.get(country) || 0) + visits);

      // Devices
      const device = event.dimensions?.deviceType || 'Desktop';
      devicesMap.set(device, (devicesMap.get(device) || 0) + visits);

      // Sources
      const source = event.dimensions?.refererHost || 'Direct';
      sourcesMap.set(source, (sourcesMap.get(source) || 0) + visits);
    });

    // Convert maps to arrays
    const timeSeries = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        visitors: data.visitors,
        pageviews: data.pageviews,
        requests: data.pageviews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const pages = Array.from(pagesMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const countries = Array.from(countriesMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const deviceTotal = Array.from(devicesMap.values()).reduce((sum, val) => sum + val, 0);
    const devices = Array.from(devicesMap.entries())
      .map(([label, value]) => ({
        label,
        value: deviceTotal > 0 ? Math.round((value / deviceTotal) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const sources = Array.from(sourcesMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const viewsPerVisit = totalVisitors > 0 ? Number((totalPageviews / totalVisitors).toFixed(2)) : 0;

    const responseData = {
      timeSeries,
      metrics: {
        visitors: totalVisitors,
        pageviews: totalPageviews,
        viewsPerVisit,
        visitDuration: 0,
        bounceRate: 0,
      },
      lists: {
        sources,
        pages,
        countries,
        devices,
      },
      last_updated: new Date().toISOString(),
    };

    console.log('📊 Analytics summary:', {
      visitors: totalVisitors,
      pageviews: totalPageviews,
      pagesCount: pages.length,
      countriesCount: countries.length,
    });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in get-cloudflare-analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timeSeries: [],
        metrics: { visitors: 0, pageviews: 0, viewsPerVisit: 0, visitDuration: 0, bounceRate: 0 },
        lists: { sources: [], pages: [], countries: [], devices: [] },
        last_updated: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
