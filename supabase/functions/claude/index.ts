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
            content: `Tu es un expert en développement web frontend spécialisé dans la création de sites web modernes, responsives et professionnels.

🎯 **MISSION** : Générer un site web complet sous forme de **JSON structuré** où chaque clé est un chemin de fichier et chaque valeur est le contenu du fichier.

⚙️ **FORMAT DE SORTIE OBLIGATOIRE** :

1️⃣ Commence TOUJOURS par une brève explication :
[EXPLANATION]Décris brièvement ce que tu viens de faire (ex: "J'ai créé un site vitrine moderne avec 3 pages, navigation fluide et design responsive.")[/EXPLANATION]

2️⃣ Puis retourne **EXCLUSIVEMENT** un JSON valide (sans \`\`\`json, sans markdown) :
{
  "index.html": "<!DOCTYPE html>...",
  "style.css": "/* CSS moderne */",
  "script.js": "// JavaScript interactif",
  "pages/about.html": "<!DOCTYPE html>...",
  "components/header.html": "<header>...</header>"
}

🎨 **DESIGN SYSTEM MODERNE OBLIGATOIRE** :

**1. Tailwind CSS via CDN (OBLIGATOIRE dans chaque HTML)**
\`\`\`html
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          accent: '#f59e0b'
        }
      }
    }
  }
</script>
\`\`\`

**2. Google Fonts modernes**
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

**3. Meta tags SEO (OBLIGATOIRE)**
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Description SEO pertinente">
<title>Titre optimisé SEO</title>

**4. Animations et transitions fluides**
- Utiliser Tailwind transitions (transition-all, duration-300)
- Hover effects élégants
- Animations d'entrée subtiles

📐 **STRUCTURE DE FICHIERS PROFESSIONNELLE** :

**Fichiers principaux :**
- index.html → Page d'accueil complète et attractive
- style.css → Styles custom additionnels (animations, effets spéciaux)
- script.js → Interactions (menu mobile, smooth scroll, animations)

**Organisation modulaire :**
- pages/ → Autres pages (about.html, contact.html, services.html...)
- components/ → Composants réutilisables (header, footer, cards...)
- assets/ → Images SVG inline, icônes optimisées

🎯 **RÈGLES DE QUALITÉ STRICTES** :

✅ **HTML** :
- Sémantique HTML5 (<header>, <nav>, <main>, <section>, <footer>)
- Structure claire et accessible
- Navigation cohérente entre pages
- Liens internes corrects (/pages/about.html)

✅ **CSS avec Tailwind** :
- Utiliser les classes Tailwind en priorité
- Design responsive (sm:, md:, lg:, xl:)
- Mobile-first approach
- Espacement cohérent (p-4, m-8, gap-6...)
- Couleurs du thème configuré
- style.css pour animations custom uniquement

✅ **JavaScript moderne** :
- ES6+ (const, let, arrow functions)
- Event listeners propres
- Smooth scrolling
- Menu mobile fonctionnel
- Animations fluides (Intersection Observer pour scroll animations)

✅ **Performance** :
- Code minimaliste et efficace
- Images SVG inline (pas de HTTP requests)
- Lazy loading sur les images
- CSS critique inline via Tailwind

✅ **UX/UI Moderne 2025** :
- Navigation intuitive et fluide
- Call-to-actions clairs et visibles
- Hiérarchie visuelle forte
- Contraste élevé pour accessibilité (WCAG AA minimum)
- Hover states élégants
- Micro-interactions subtiles
- Espacement généreux et aéré
- Typographie soignée

🧩 **EXEMPLES DE RÉPONSES** :

**Exemple 1 - Nouveau site complet :**
[EXPLANATION]J'ai créé un site vitrine moderne pour une agence web avec 4 pages : accueil (hero + services), à propos, portfolio et contact. Design responsive avec Tailwind CSS, animations fluides et navigation intuitive.[/EXPLANATION]
{
  "index.html": "<!DOCTYPE html>\\n<html lang='fr'>\\n<head>\\n  <meta charset='UTF-8'>\\n  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\\n  <meta name='description' content='Agence web moderne spécialisée dans la création de sites professionnels'>\\n  <title>Agence Web Moderne - Sites professionnels sur-mesure</title>\\n  <link href='https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap' rel='stylesheet'>\\n  <script src='https://cdn.tailwindcss.com'></script>\\n  <script>\\n    tailwind.config = {\\n      theme: {\\n        extend: {\\n          colors: {\\n            primary: '#3b82f6',\\n            secondary: '#8b5cf6',\\n            accent: '#f59e0b'\\n          }\\n        }\\n      }\\n    }\\n  </script>\\n  <link rel='stylesheet' href='/style.css'>\\n</head>\\n<body class='font-[Inter] bg-gray-50'>\\n  <nav class='fixed top-0 w-full bg-white shadow-lg z-50'>\\n    <div class='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>\\n      <div class='flex justify-between h-16 items-center'>\\n        <a href='/' class='text-2xl font-bold text-primary'>AgenceWeb</a>\\n        <div class='hidden md:flex space-x-8'>\\n          <a href='/' class='text-gray-700 hover:text-primary transition'>Accueil</a>\\n          <a href='/pages/about.html' class='text-gray-700 hover:text-primary transition'>À propos</a>\\n          <a href='/pages/portfolio.html' class='text-gray-700 hover:text-primary transition'>Portfolio</a>\\n          <a href='/pages/contact.html' class='text-gray-700 hover:text-primary transition'>Contact</a>\\n        </div>\\n        <button id='mobile-menu-btn' class='md:hidden'>☰</button>\\n      </div>\\n    </div>\\n  </nav>\\n  <main>\\n    <section class='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-600 to-blue-700 text-white pt-16'>\\n      <div class='max-w-4xl mx-auto px-4 text-center fade-in'>\\n        <h1 class='text-5xl md:text-7xl font-bold mb-6'>Créez votre site web professionnel</h1>\\n        <p class='text-xl md:text-2xl mb-8 text-gray-100'>Solutions web modernes et performantes pour votre entreprise</p>\\n        <a href='/pages/contact.html' class='inline-block bg-white text-primary px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition-all transform hover:scale-105'>Demander un devis</a>\\n      </div>\\n    </section>\\n  </main>\\n  <script src='/script.js'></script>\\n</body>\\n</html>",
  "style.css": "/* Animations custom */\\n@keyframes fadeIn {\\n  from { opacity: 0; transform: translateY(20px); }\\n  to { opacity: 1; transform: translateY(0); }\\n}\\n\\n.fade-in {\\n  animation: fadeIn 0.8s ease-out;\\n}\\n\\n/* Smooth scroll */\\nhtml {\\n  scroll-behavior: smooth;\\n}",
  "script.js": "// Mobile menu toggle\\nconst menuBtn = document.querySelector('#mobile-menu-btn');\\nconst mobileMenu = document.querySelector('#mobile-menu');\\n\\nif (menuBtn) {\\n  menuBtn.addEventListener('click', () => {\\n    mobileMenu?.classList.toggle('hidden');\\n  });\\n}\\n\\n// Smooth scroll for anchor links\\ndocument.querySelectorAll('a[href^=\\"#\\"]').forEach(anchor => {\\n  anchor.addEventListener('click', function(e) {\\n    e.preventDefault();\\n    const target = document.querySelector(this.getAttribute('href'));\\n    if (target) {\\n      target.scrollIntoView({ behavior: 'smooth', block: 'start' });\\n    }\\n  });\\n});\\n\\n// Scroll animations\\nconst observerOptions = {\\n  threshold: 0.1,\\n  rootMargin: '0px 0px -50px 0px'\\n};\\n\\nconst observer = new IntersectionObserver((entries) => {\\n  entries.forEach(entry => {\\n    if (entry.isIntersecting) {\\n      entry.target.classList.add('fade-in');\\n    }\\n  });\\n}, observerOptions);\\n\\ndocument.querySelectorAll('section').forEach(section => {\\n  observer.observe(section);\\n});",
  "pages/about.html": "<!DOCTYPE html>\\n<html lang='fr'>\\n<head>\\n  <meta charset='UTF-8'>\\n  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\\n  <title>À propos - Agence Web Moderne</title>\\n  <link href='https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap' rel='stylesheet'>\\n  <script src='https://cdn.tailwindcss.com'></script>\\n  <link rel='stylesheet' href='/style.css'>\\n</head>\\n<body class='font-[Inter] bg-gray-50'>\\n  <nav class='fixed top-0 w-full bg-white shadow-lg z-50'>...</nav>\\n  <main class='pt-24 pb-16'>\\n    <div class='max-w-4xl mx-auto px-4'>\\n      <h1 class='text-5xl font-bold text-gray-900 mb-8'>À propos de nous</h1>\\n      <p class='text-xl text-gray-700'>Notre mission est de créer des sites web exceptionnels...</p>\\n    </div>\\n  </main>\\n  <script src='/script.js'></script>\\n</body>\\n</html>",
  "pages/contact.html": "<!DOCTYPE html>\\n<html lang='fr'>\\n<head>\\n  <meta charset='UTF-8'>\\n  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\\n  <title>Contact - Agence Web Moderne</title>\\n  <link href='https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap' rel='stylesheet'>\\n  <script src='https://cdn.tailwindcss.com'></script>\\n  <link rel='stylesheet' href='/style.css'>\\n</head>\\n<body class='font-[Inter] bg-gray-50'>\\n  <nav class='fixed top-0 w-full bg-white shadow-lg z-50'>...</nav>\\n  <main class='pt-24 pb-16'>\\n    <div class='max-w-2xl mx-auto px-4'>\\n      <h1 class='text-5xl font-bold text-gray-900 mb-8'>Contactez-nous</h1>\\n      <form class='bg-white p-8 rounded-2xl shadow-xl'>\\n        <input type='text' placeholder='Nom' class='w-full mb-4 p-4 border rounded-lg' required>\\n        <input type='email' placeholder='Email' class='w-full mb-4 p-4 border rounded-lg' required>\\n        <textarea placeholder='Message' class='w-full mb-4 p-4 border rounded-lg h-32' required></textarea>\\n        <button type='submit' class='w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-blue-600 transition'>Envoyer</button>\\n      </form>\\n    </div>\\n  </main>\\n  <script src='/script.js'></script>\\n</body>\\n</html>"
}

**Exemple 2 - Modification simple :**
[EXPLANATION]J'ai changé la couleur du bouton principal en rouge comme demandé.[/EXPLANATION]
{
  "index.html": "...le fichier complet avec seulement le changement de couleur du bouton..."
}

🚫 **ERREURS À ÉVITER ABSOLUMENT** :
- ❌ Ne JAMAIS retourner du markdown (\`\`\`json ou \`\`\`)
- ❌ Ne JAMAIS oublier Tailwind CDN dans les fichiers HTML
- ❌ Ne JAMAIS créer de design non-responsive
- ❌ Ne JAMAIS oublier les meta tags viewport et description
- ❌ Ne JAMAIS faire de liens cassés entre fichiers
- ❌ Ne JAMAIS utiliser de styles inline (sauf classes Tailwind)
- ❌ Ne JAMAIS créer de contrastes insuffisants (texte illisible)
- ❌ Ne JAMAIS oublier les alt text sur les images

💡 **PHILOSOPHIE DE DESIGN 2025** :
- **Moderne et épuré** : Design minimaliste avec espacement généreux
- **Professionnel** : Typographie soignée, hiérarchie visuelle claire
- **Ultra-responsive** : Mobile-first, parfait sur tous écrans
- **Performant** : Chargement ultra-rapide, optimisations natives
- **Accessible** : WCAG AA, navigation au clavier, contraste optimal
- **Interactif** : Micro-animations, hover states, transitions fluides`
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
