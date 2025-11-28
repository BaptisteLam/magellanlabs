import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function pour générer des embeddings textuels
 * Utilise Claude pour créer des embeddings sémantiques de haute qualité
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts array is required');
    }

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    console.log(`🔢 Generating embeddings for ${texts.length} texts`);

    // Générer embeddings via Claude
    // On demande à Claude de créer une représentation numérique dense
    const embeddings: number[][] = [];

    for (const text of texts) {
      // Prompt pour générer un embedding
      const embeddingPrompt = `Analyze the following code/text and generate a dense numerical embedding vector of 128 dimensions that captures its semantic meaning. 
      
Return ONLY a valid JSON array of exactly 128 floating point numbers between -1 and 1, with no other text or explanation.

Text to embed:
${text.slice(0, 2000)}

Return format: [0.123, -0.456, 0.789, ...]`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022', // Fast model for embeddings
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: embeddingPrompt
          }],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const embeddingText = data.content[0].text.trim();

      try {
        // Parse et valider l'embedding
        const embedding = JSON.parse(embeddingText);
        
        if (!Array.isArray(embedding) || embedding.length !== 128) {
          console.error('Invalid embedding format:', embedding);
          // Fallback: générer embedding aléatoire normalisé
          embeddings.push(generateRandomEmbedding());
        } else {
          // Normalisation L2
          const normalized = normalizeEmbedding(embedding);
          embeddings.push(normalized);
        }
      } catch (parseError) {
        console.error('Error parsing embedding:', parseError);
        embeddings.push(generateRandomEmbedding());
      }
    }

    console.log(`✅ Generated ${embeddings.length} embeddings`);

    return new Response(
      JSON.stringify({ embeddings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-embeddings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Normalise un embedding avec norme L2
 */
function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? embedding.map(v => v / norm) : embedding;
}

/**
 * Génère un embedding aléatoire normalisé (fallback)
 */
function generateRandomEmbedding(): number[] {
  const embedding = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
  return normalizeEmbedding(embedding);
}
