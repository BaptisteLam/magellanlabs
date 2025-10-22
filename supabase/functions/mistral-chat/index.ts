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
    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages array is required');
    }

    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    
    if (!MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is not configured');
    }

    console.log('Calling OpenRouter API with messages:', messages);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trinitystudio.fr',
        'X-Title': 'Trinity Studio AI',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3.2-24b-instruct',
        temperature: 0.7,
        messages: [
          { 
            role: 'system', 
            content: `You are Mistral Small 3.2 with the "Landing Page Builder" capability.

When the user provides a project or idea, automatically generate a complete, responsive landing page with:
- Clean HTML5 structure with semantic tags
- Embedded CSS in <style> tags (modern, professional design)
- Optional vanilla JavaScript for interactivity
- Mobile-responsive design
- Professional typography and color scheme

When the user asks to modify the page, apply the changes while keeping the rest intact.

IMPORTANT: 
- Return ONLY the complete HTML code, nothing else
- No markdown code blocks, no explanations
- Start with <!DOCTYPE html> and end with </html>
- The code must be ready to display in an iframe` 
          },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenRouter API response received');
    
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
