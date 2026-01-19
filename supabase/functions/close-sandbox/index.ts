import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const E2B_API_KEY = Deno.env.get('E2B_API_KEY');
    if (!E2B_API_KEY) {
      throw new Error('E2B_API_KEY not configured');
    }

    const { sandboxId } = await req.json();

    if (!sandboxId) {
      throw new Error('sandboxId is required');
    }

    console.log('[close-sandbox] Closing sandbox:', sandboxId);

    // Use REST API to delete sandbox
    const response = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': E2B_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[close-sandbox] Delete response:', response.status, errorText);
      // Don't throw - sandbox might already be closed
    } else {
      console.log('[close-sandbox] Sandbox closed successfully');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[close-sandbox] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
