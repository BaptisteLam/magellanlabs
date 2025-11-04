import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  property_id: string;
  period: 'today' | '7d' | '30d' | '90d';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { property_id, period }: AnalyticsRequest = await req.json();
    
    if (!property_id || !period) {
      return new Response(
        JSON.stringify({ error: 'Missing property_id or period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GA service account key
    const GA_SERVICE_KEY = Deno.env.get('GA_SERVICE_KEY');
    if (!GA_SERVICE_KEY) {
      console.error('GA_SERVICE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'GA_SERVICE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse service account credentials
    const credentials = JSON.parse(GA_SERVICE_KEY);

    // Convert period to date range
    const today = new Date().toISOString().split('T')[0];
    let startDate: string;
    
    switch (period) {
      case 'today':
        startDate = today;
        break;
      case '7d':
        startDate = '7daysAgo';
        break;
      case '30d':
        startDate = '30daysAgo';
        break;
      case '90d':
        startDate = '90daysAgo';
        break;
      default:
        startDate = '7daysAgo';
    }

    // Get access token from Google
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaim = btoa(JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }));

    // Import private key for signing
    const privateKey = credentials.private_key;
    const importedKey = await crypto.subtle.importKey(
      'pkcs8',
      Uint8Array.from(atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')), c => c.charCodeAt(0)),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      importedKey,
      new TextEncoder().encode(`${jwtHeader}.${jwtClaim}`)
    );

    const jwt = `${jwtHeader}.${jwtClaim}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const { access_token } = await tokenResponse.json();
    console.log('Got access token');

    // Helper function to run GA4 reports
    const runReport = async (dimensions: string[], metrics: string[]) => {
      const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [{ startDate, endDate: 'today' }],
            dimensions: dimensions.map(name => ({ name })),
            metrics: metrics.map(name => ({ name })),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('GA4 API error:', error);
        throw new Error(`GA4 API error: ${error}`);
      }

      return await response.json();
    };

    // Fetch all analytics data
    console.log('Fetching analytics data...');

    // 1. Total visits
    const totalVisitsData = await runReport([], ['screenPageViews']);
    const visits = totalVisitsData.rows?.[0]?.metricValues?.[0]?.value || '0';

    // 2. By country
    const countryData = await runReport(['country'], ['screenPageViews']);
    const by_country = countryData.rows?.map((row: any) => ({
      country: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value),
    })) || [];

    // 3. By page
    const pageData = await runReport(['pagePath'], ['screenPageViews']);
    const by_page = pageData.rows?.map((row: any) => ({
      path: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value),
    })) || [];

    // 4. By device
    const deviceData = await runReport(['deviceCategory'], ['screenPageViews']);
    const by_device = deviceData.rows?.map((row: any) => ({
      device: row.dimensionValues[0].value.toLowerCase(),
      views: parseInt(row.metricValues[0].value),
    })) || [];

    console.log('Analytics data fetched successfully');

    return new Response(
      JSON.stringify({
        visits: parseInt(visits),
        by_country,
        by_page,
        by_device,
        last_updated: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in get-analytics function:', error);
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
