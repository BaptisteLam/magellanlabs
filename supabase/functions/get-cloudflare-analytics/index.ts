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

    console.log('📊 Fetching analytics for:', {
      siteToken,
      accountId: cloudflareAccountId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      period
    });

    // Use Cloudflare REST API for Web Analytics
    console.log('📊 Fetching aggregate analytics data...');
    
    const analyticsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/rum/site_info/${siteToken}/aggregate?since=${startDate.toISOString()}&until=${endDate.toISOString()}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Email': cloudflareEmail,
          'X-Auth-Key': cloudflareApiToken,
        },
      }
    );

    if (!analyticsResponse.ok) {
      const errorData = await analyticsResponse.json();
      console.error('❌ Failed to fetch analytics:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Les données peuvent prendre 24-48h à apparaître après la première publication.',
          details: errorData 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const analyticsData = await analyticsResponse.json();
    console.log('✅ Analytics data received');

    const data = analyticsData.result || {};

    // Process time series data from timeseries bucket
    const timeSeriesMap = new Map<string, { visitors: number; pageviews: number }>();
    (data.timeseries || []).forEach((item: any) => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      timeSeriesMap.set(date, {
        visitors: item.visits || 0,
        pageviews: item.pageViews || 0,
      });
    });

    const timeSeries = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        visitors: data.visitors,
        pageviews: data.pageviews,
        requests: data.pageviews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate metrics from totals
    const totalVisitors = data.totals?.visits || 0;
    const totalPageviews = data.totals?.pageViews || 0;
    const viewsPerVisit = totalVisitors > 0 ? Number((totalPageviews / totalVisitors).toFixed(2)) : 0;
    const bounceRate = data.totals?.bounceRate || 0;

    console.log('📊 Metrics calculated:', { totalVisitors, totalPageviews, viewsPerVisit, bounceRate });

    // Process pages
    const pages = (data.topPages || [])
      .map((item: any) => ({
        label: item.page || '/',
        value: item.pageViews || 0,
      }))
      .slice(0, 10);

    // Process countries
    const countries = (data.topLocations || [])
      .map((item: any) => ({
        label: item.location || 'Unknown',
        value: item.visits || 0,
      }))
      .slice(0, 10);

    // Process devices
    const deviceTotal = (data.topDeviceTypes || []).reduce((sum: number, d: any) => sum + (d.visits || 0), 0);
    const devices = (data.topDeviceTypes || [])
      .map((item: any) => ({
        label: item.deviceType || 'Unknown',
        value: deviceTotal > 0 ? Math.round(((item.visits || 0) / deviceTotal) * 100) : 0,
      }));

    // Process referrers (sources)
    const sources = (data.topReferrers || [])
      .map((item: any) => ({
        label: item.referrer || 'Direct',
        value: item.visits || 0,
      }))
      .slice(0, 10);

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
