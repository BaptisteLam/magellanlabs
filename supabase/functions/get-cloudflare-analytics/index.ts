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
    const cloudflareEmail = Deno.env.get('CLOUDFLARE_EMAIL');

    if (!cloudflareApiToken || !cloudflareAccountId || !cloudflareEmail) {
      throw new Error('Missing Cloudflare credentials');
    }

    // GraphQL query for Web Analytics data
    const graphqlQuery = {
      query: `
        query GetWebAnalytics($accountTag: string!, $siteTag: string!, $startDate: string!, $endDate: string!) {
          viewer {
            accounts(filter: { accountTag: $accountTag }) {
              timeSeries: rumPageloadEventsAdaptiveGroups(
                filter: {
                  siteTag: $siteTag
                  datetime_geq: $startDate
                  datetime_leq: $endDate
                }
                limit: 1000
                orderBy: [datetimeFifteenMinutes_ASC]
              ) {
                count
                sum {
                  visits
                }
                dimensions {
                  date: datetimeFifteenMinutes
                }
              }
              
              pages: rumPageloadEventsAdaptiveGroups(
                filter: {
                  siteTag: $siteTag
                  datetime_geq: $startDate
                  datetime_leq: $endDate
                }
                limit: 10
                orderBy: [count_DESC]
              ) {
                count
                dimensions {
                  requestPath
                }
              }
              
              countries: rumPageloadEventsAdaptiveGroups(
                filter: {
                  siteTag: $siteTag
                  datetime_geq: $startDate
                  datetime_leq: $endDate
                }
                limit: 10
                orderBy: [count_DESC]
              ) {
                count
                dimensions {
                  countryName
                }
              }
              
              devices: rumPageloadEventsAdaptiveGroups(
                filter: {
                  siteTag: $siteTag
                  datetime_geq: $startDate
                  datetime_leq: $endDate
                }
                limit: 10
                orderBy: [count_DESC]
              ) {
                count
                dimensions {
                  deviceType
                }
              }
              
              referrers: rumPageloadEventsAdaptiveGroups(
                filter: {
                  siteTag: $siteTag
                  datetime_geq: $startDate
                  datetime_leq: $endDate
                }
                limit: 10
                orderBy: [count_DESC]
              ) {
                count
                dimensions {
                  refererHost
                }
              }
            }
          }
        }
      `,
      variables: {
        accountTag: cloudflareAccountId,
        siteTag: siteToken,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    console.log('📊 Fetching Web Analytics data for site:', siteToken);

    const analyticsResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'X-Auth-Email': cloudflareEmail,
        'X-Auth-Key': cloudflareApiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!analyticsResponse.ok) {
      const errorText = await analyticsResponse.text();
      console.error('❌ Cloudflare API error:', analyticsResponse.status, errorText);
      throw new Error(`Cloudflare API error: ${analyticsResponse.status}`);
    }

    const analyticsData = await analyticsResponse.json();
    console.log('✅ Analytics data received');

    if (analyticsData.errors) {
      console.error('❌ GraphQL errors:', analyticsData.errors);
      throw new Error('GraphQL query failed');
    }

    const result = analyticsData.data?.viewer?.accounts?.[0];
    if (!result) {
      throw new Error('No analytics data returned');
    }

    // Process time series data - aggregate by day
    const timeSeriesMap = new Map<string, { visitors: number; pageviews: number }>();
    result.timeSeries?.forEach((item: any) => {
      const date = new Date(item.dimensions.date).toISOString().split('T')[0];
      const existing = timeSeriesMap.get(date) || { visitors: 0, pageviews: 0 };
      existing.visitors += item.count || 0;
      existing.pageviews += item.sum?.visits || 0;
      timeSeriesMap.set(date, existing);
    });

    const timeSeries = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        visitors: data.visitors,
        pageviews: data.pageviews,
        requests: data.pageviews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate metrics
    const totalVisitors = timeSeries.reduce((sum, d) => sum + d.visitors, 0);
    const totalPageviews = timeSeries.reduce((sum, d) => sum + d.pageviews, 0);
    const viewsPerVisit = totalVisitors > 0 ? Number((totalPageviews / totalVisitors).toFixed(2)) : 0;
    
    // Calculate bounce rate (simplified - pages with single pageview)
    const singlePageVisits = result.pages?.filter((p: any) => p.count === 1).length || 0;
    const totalVisits = result.pages?.length || 1;
    const bounceRate = Math.round((singlePageVisits / totalVisits) * 100);

    // Process pages
    const pages = (result.pages || [])
      .map((item: any) => ({
        label: item.dimensions.requestPath || '/',
        value: item.count || 0,
      }))
      .filter((p: any) => p.label !== null);

    // Process countries
    const countries = (result.countries || [])
      .map((item: any) => ({
        label: item.dimensions.countryName || 'Unknown',
        value: item.count || 0,
      }))
      .filter((c: any) => c.label !== 'Unknown');

    // Process devices
    const deviceTotal = (result.devices || []).reduce((sum: number, d: any) => sum + (d.count || 0), 0);
    const devices = (result.devices || [])
      .map((item: any) => ({
        label: item.dimensions.deviceType || 'Unknown',
        value: deviceTotal > 0 ? Math.round(((item.count || 0) / deviceTotal) * 100) : 0,
      }))
      .filter((d: any) => d.label !== 'Unknown');

    // Process referrers (sources)
    const sources = (result.referrers || [])
      .map((item: any) => ({
        label: item.dimensions.refererHost || 'Direct',
        value: item.count || 0,
      }));

    const responseData = {
      timeSeries,
      metrics: {
        visitors: totalVisitors,
        pageviews: totalPageviews,
        viewsPerVisit,
        visitDuration: 0,
        bounceRate,
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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
