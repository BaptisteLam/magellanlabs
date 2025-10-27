import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    console.log("Calling OpenRouter API with messages:", messages);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        max_tokens: 10000,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `Tu es un expert en création de sites web complets et professionnels.

⚙️ FORMAT DE SORTIE OBLIGATOIRE :

1. Commence TOUJOURS par une explication entre balises :
[EXPLANATION]Décris brièvement ce que tu viens de faire (ex: "J'ai créé un site vitrine moderne avec page d'accueil, page à propos et formulaire de contact.")[/EXPLANATION]

2. Puis renvoie EXCLUSIVEMENT un JSON de ce type (sans markdown, sans \`\`\`json) :
{
  "index.html": "<!DOCTYPE html>...contenu complet du HTML...",
  "style.css": "/* styles complets ici */",
  "script.js": "// scripts JS ici",
  "pages/about.html": "<!DOCTYPE html>...",
  "pages/contact.html": "<!DOCTYPE html>...",
  "components/navbar.html": "<nav>...</nav>",
  "assets/logo.svg": "<svg>...</svg>"
}

🎯 RÈGLES STRICTES :

1. Retourne TOUJOURS un JSON valide, sans markdown (\`\`\`), sans texte supplémentaire
2. Chaque fichier HTML doit être complet (<!DOCTYPE html>, <head>, <body>)
3. Inclure les liens entre fichiers :
   - <link rel="stylesheet" href="/style.css">
   - <script src="/script.js"></script>
   - <a href="/pages/about.html">À propos</a>
4. Si plusieurs pages : elles doivent être autonomes et navigables
5. Pour les composants HTML : utiliser des includes simples ou copier-coller (pas de frameworks)
6. Organiser les fichiers de manière cohérente (index.html à la racine, pages/, components/, assets/)
7. CSS moderne : flexbox, grid, responsive, animations fluides
8. JavaScript vanilla uniquement (pas de frameworks, pas de dépendances externes)
9. Design professionnel : palette cohérente, typographie claire, espacement harmonieux
10. Accessibilité : landmarks HTML5, alt text, labels, focus states
11. SEO : meta tags, Open Graph, balises sémantiques
12. Performance : images optimisées, CSS/JS minifiés mentalement

🔄 COMPORTEMENT POUR MODIFICATIONS :

Si l'utilisateur demande une modification :
- NE régénère PAS tout le site
- Retourne SEULEMENT les fichiers modifiés dans le même format JSON
- Exemple : si changement de couleur du bouton → retourne seulement { "style.css": "..." }
- Conserve toute la structure existante non mentionnée

📦 STRUCTURE RECOMMANDÉE :

{
  "index.html": "page d'accueil",
  "style.css": "styles globaux",
  "script.js": "scripts globaux",
  "pages/about.html": "page à propos",
  "pages/contact.html": "page contact",
  "pages/services.html": "page services",
  "components/header.html": "composant header",
  "components/footer.html": "composant footer",
  "assets/logo.svg": "logo SVG inline"
}

🧩 EXEMPLE COMPLET :

[EXPLANATION]J'ai créé un site vitrine pour une entreprise tech avec 3 pages (accueil, services, contact), navigation responsive et formulaire de contact fonctionnel.[/EXPLANATION]
{
  "index.html": "<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Accueil</title><link rel='stylesheet' href='/style.css'></head><body><nav>...</nav><main>...</main><script src='/script.js'></script></body></html>",
  "style.css": "* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: system-ui; }",
  "script.js": "console.log('Site loaded');",
  "pages/services.html": "<!DOCTYPE html>...",
  "pages/contact.html": "<!DOCTYPE html>..."
}

IMPORTANT - Images :
- Utilise des URLs d'images gratuites (unsplash.com, pexels.com)
- Ou crée des SVG inline pour les icônes/logos
- NE génère PAS d'images avec l'IA
- Format : https://images.unsplash.com/photo-[id]?w=[width]&h=[height]&fit=crop`
          },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OpenRouter API response received");

    let generatedText = data.choices?.[0]?.message?.content || "";

    // Contrôle de contraste automatique
    if (/background:\s*(#0f172a|#000)/i.test(generatedText) && /color:\s*(#000|black)/i.test(generatedText)) {
      generatedText = generatedText.replace(/color:\s*(#000|black)/gi, 'color: #f8fafc');
    }

    // Detect and generate contextual images with Gemini
    const imageGenPattern = /<!--\s*GENERATE_IMAGE:\s*([^|]+)\|\s*(\d+)x(\d+)\s*-->/g;
    const imagesToGenerate = [];
    let match;

    while ((match = imageGenPattern.exec(generatedText)) !== null) {
      imagesToGenerate.push({
        placeholder: match[0],
        description: match[1].trim(),
        width: parseInt(match[2]),
        height: parseInt(match[3])
      });
    }

    console.log(`Found ${imagesToGenerate.length} images to generate`);

    // Generate images with Gemini 2.5 Flash Image Preview
    for (const imageRequest of imagesToGenerate) {
      try {
        console.log(`Generating image: ${imageRequest.description} (${imageRequest.width}x${imageRequest.height})`);
        
        const imageResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: `Generate a professional, high-quality image for a website: ${imageRequest.description}. Aspect ratio should match ${imageRequest.width}x${imageRequest.height}. Ultra high resolution.`
              }
            ],
            modalities: ["image", "text"]
          })
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (generatedImageUrl) {
            // Replace the placeholder with actual img tag
            const imgTag = `<img src="${generatedImageUrl}" alt="${imageRequest.description}" style="max-width: 100%; height: auto; border-radius: var(--radius, 14px);" loading="lazy" />`;
            generatedText = generatedText.replace(imageRequest.placeholder, imgTag);
            console.log(`Successfully generated and inserted image: ${imageRequest.description}`);
          } else {
            console.error("No image URL in response for:", imageRequest.description);
          }
        } else {
          const errorText = await imageResponse.text();
          console.error(`Failed to generate image: ${imageResponse.status}`, errorText);
        }
      } catch (error) {
        console.error(`Error generating image for "${imageRequest.description}":`, error);
      }
    }

    return new Response(JSON.stringify({ response: generatedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in claude function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
