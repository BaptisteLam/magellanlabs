import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { prompt } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    console.log('🎯 Generating project name for:', prompt);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [
          { 
            role: 'user', 
            content: `Tu es un assistant qui génère des noms de projets courts et pertinents. Réponds uniquement avec le nom du projet, sans ponctuation, sans guillemets, en 2-4 mots maximum. Exemples: "BeerWorld Explorer", "Portfolio Designer", "Task Manager Pro"\n\nGénère un nom de projet court et accrocheur (2-4 mots max) pour: "${prompt}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API error:', response.status, errorText);
      
      // Fallback en cas d'erreur
      return new Response(JSON.stringify({ 
        projectName: 'Mon Nouveau Projet' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const projectName = data.content[0]?.text?.trim() || 'Mon Nouveau Projet';
    
    console.log('✅ Generated project name:', projectName);

    return new Response(JSON.stringify({ projectName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error generating project name:', error);
    
    // Fallback en cas d'erreur
    return new Response(JSON.stringify({ 
      projectName: 'Mon Nouveau Projet' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
