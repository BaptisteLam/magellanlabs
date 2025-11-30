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
      console.error('❌ ANTHROPIC_API_KEY not configured');
      throw new Error('API key non configurée');
    }

    console.log('🎯 Generating project name for:', prompt.substring(0, 100));

    // Fonction de retry avec backoff exponentiel
    const fetchWithRetry = async (attemptNumber: number = 0): Promise<any> => {
      const maxRetries = 3;
      const delay = Math.min(1000 * Math.pow(2, attemptNumber), 5000);

      try {
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
                content: `Tu es un assistant qui génère des noms de projets courts et pertinents basés sur le contexte fourni. Réponds UNIQUEMENT avec le nom du projet, sans ponctuation, sans guillemets, en 2-4 mots maximum.

Exemples:
- Prompt: "site web pour cabinet d'avocat" → "Cabinet Juridique Pro"
- Prompt: "landing page app coaching sportif" → "SportCoach Landing"
- Prompt: "marketplace location voitures" → "AutoShare Marketplace"
- Prompt: "site e-commerce t-shirts" → "TeeShirt Store"

Génère maintenant un nom court et accrocheur (2-4 mots max) pour: "${prompt}"`
              }
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Claude API error (attempt ${attemptNumber + 1}/${maxRetries + 1}):`, response.status, errorText);
          
          // Retry pour erreurs 5xx ou 429
          if ((response.status >= 500 || response.status === 429) && attemptNumber < maxRetries) {
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(attemptNumber + 1);
          }
          
          throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        const projectName = data.content[0]?.text?.trim();
        
        if (!projectName) {
          throw new Error('Empty project name returned');
        }

        console.log('✅ Generated project name:', projectName);
        return projectName;

      } catch (error) {
        // Retry pour erreurs réseau
        if (attemptNumber < maxRetries) {
          console.log(`⚠️ Network error (attempt ${attemptNumber + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(attemptNumber + 1);
        }
        throw error;
      }
    };

    // Tenter de générer avec Claude (avec retries)
    const projectName = await fetchWithRetry();

    return new Response(JSON.stringify({ projectName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Critical error generating project name:', error);
    
    // En dernier recours, générer un nom basique mais pertinent basé sur le prompt
    const { prompt } = await req.json().catch(() => ({ prompt: '' }));
    
    // Extraire des mots-clés du prompt pour créer un nom minimal
    const keywords = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\sàâäéèêëïîôöùûüÿæœç-]/gi, ' ')
      .split(/\s+/)
      .filter((word: string) => word.length > 3)
      .slice(0, 2);
    
    const fallbackName = keywords.length > 0 
      ? keywords.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Project'
      : `Project ${new Date().toISOString().split('T')[0]}`;
    
    console.log('⚠️ Using fallback name:', fallbackName);
    
    return new Response(JSON.stringify({ projectName: fallbackName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
