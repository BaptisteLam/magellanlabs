import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    
    if (!MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is not configured');
    }

    console.log('Calling OpenRouter API with prompt:', prompt);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trinitystudio.fr',
        'X-Title': 'Trinity Studio AI',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3.2-24b',
        temperature: 0.5,
        messages: [
          { 
            role: 'system', 
            content: `You are Mistral Small 3.2 with the "Landing Page Builder" capability.
When the user provides a project or idea, automatically generate:
- HTML, CSS, and JS code for a responsive landing page
- A live preview of the page on the right side
- The editable source code on the left side
- Allow the user to edit both text and code, and instantly update the preview.

IMPORTANT: Use the built-in landing page builder mode.` 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral API error:', response.status, errorText);
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Mistral API response received');
    
    const generatedText = data.choices[0].message.content;

    return new Response(JSON.stringify({ response: generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in mistral-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
