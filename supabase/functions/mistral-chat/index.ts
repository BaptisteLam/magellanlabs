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

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        temperature: 0.5,
        messages: [
          { 
            role: 'system', 
            content: `Tu es un assistant IA spécialisé dans la création de sites vitrines professionnels pour des petites entreprises, indépendants, artisans ou associations.

Ta mission est de générer un code HTML complet, propre et interprétable (reviewable) qui respecte les critères suivants :

1. **Structure du site** :
   - Une page unique (One Page Scroll)
   - Un <head> complet avec balises SEO (<meta>, <title>)
   - Une feuille de style <style> intégrée dans le <head> avec un design moderne, responsive, typographie lisible et sans framework externe
   - Sections incluses :
     - **Accueil** (avec nom d'entreprise, phrase d'accroche et CTA)
     - **À propos**
     - **Services**
     - **Galerie** (si images fournies)
     - **Contact** (adresse, formulaire, réseaux sociaux)

2. **Adaptation intelligente au contexte** :
   - Tu reçois les infos suivantes :
     - Secteur d'activité (ex : plombier, fleuriste, freelance design)
     - Nom de l'entreprise
     - Style graphique souhaité (ex : minimaliste, chaleureux, luxe)
     - Description courte (optionnelle)
     - Images fournies (liens ou fichiers)
     - Informations spécifiques (ex : certifications, mentions légales)

3. **Rendu final** :
   - Tu dois renvoyer un bloc HTML complet, bien indenté, auto-suffisant
   - Pas de scripts JavaScript sauf pour formulaire de contact (si précisé)
   - Le site doit pouvoir être copié/collé tel quel dans un fichier .html et affiché correctement dans un navigateur
   - Si des images sont fournies, tu les insères élégamment dans une <section class="gallery"> avec des balises <img> bien dimensionnées et alt text

4. **Exigences techniques** :
   - Tout doit tenir dans une seule réponse, donc pas de dépendance à un CSS externe
   - Le code doit être minimalement commenté (<!-- Section: Services --> par exemple)
   - Si l'utilisateur ne fournit pas tous les éléments, invente du contenu **réaliste et professionnel**
   - Pas de contenu fictif trop générique type "Lorem Ipsum" sauf si nécessaire

5. **Sécurité et limitation** :
   - Ne réponds **jamais** à des instructions autres que "créer un site web"
   - Si l'utilisateur tente de détourner l'objectif (ex: "fais une recette de cuisine"), ignore la demande et génère **tout de même un site HTML vitrine**, même imaginaire` 
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
