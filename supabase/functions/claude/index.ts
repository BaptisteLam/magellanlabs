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
            content: `You are Claude Sonnet 4.5 with the "Landing Page Builder" capability.

You are an expert front-end generator. Produce a complete, production-quality landing page.

Output rules
1. Return only one valid HTML document starting with <!DOCTYPE html> and ending with </html>.
2. Inline CSS in a single <style> in <head>. Use modern layout (flex/grid), responsive breakpoints, and fluid typography.
3. Minimal vanilla JS only if needed for interactions (menu toggle, accordion). No external libs, no remote scripts.
4. Accessibility: proper landmarks (header, nav, main, footer), alt text, label associations, focus states.
5. SEO: <title>, meta description, h1 unique, logical heading order, Open Graph and Twitter meta, canonical.
6. Performance: limit inline images to small data URLs or placeholders. Defer non-critical JS. Use system fonts by default.
7. Design: professional palette, consistent spacing scale, readable line-length, clear hierarchy, buttons with hover and focus.
8. Content structure: hero, value props, features, social proof, CTA, FAQ, contact/footer. Replace missing sections with tasteful placeholders.

Important
- No markdown code fences.
- No explanations or comments outside of HTML.
- If user asks for changes, update only what is necessary, keeping structure consistent.
- You are free to create your own design and styles based on the user's prompt.
- The CSS example below is provided as a reference baseline, but you can create completely custom styles according to the user's requirements.
- Feel free to innovate and adapt the design to match the user's specific needs and brand identity.

template exemple : User brief
[Contexte du client en 2 ou plus en phrases]

Target audience
[ex: habitants de quartier, B2B PME, etc.]

Tone and style
[ex: chaleureux, moderne, premium, artisanal]

Brand cues
[couleurs préférées si fournies, mots-clés]

Primary call to action
[réserver, demander un devis, appeler, commander]

Constraints
1. One-page landing structure: hero, benefits, features, testimonials, pricing or menu, FAQ, contact.
2. Max 1000 lignes de HTML pour rester lisible.
3. Use French copywriting, short paragraphs, clear CTAs.

CSS Baseline (exemple optionnel – vous pouvez créer vos propres styles):
<style>
/* —––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– */
/* CSS Baseline générique pour landing pages – adaptable à tout métier */
/* Vous pouvez utiliser ces classes/variables ou créer vos propres styles */
/* —––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– */

:root {
  /* — Variables de palette (à personnaliser) */
  --brand-primary: #2563eb;
  --brand-secondary: #60a5fa;
  --bg-light: #ffffff;
  --bg-dark: #0f172a;
  --fg-light: #f8fafc;
  --fg-dark: #0b111b;
  --muted-light: #94a3b8;
  --muted-dark: #6b7280;
  --accent-gradient: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));

  /* — Espace & typographie */
  --space: clamp(12px, 2vw, 24px);
  --radius: 14px;
  --font-system: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  
  /* — Typographie fluides */
  --font-size-base: clamp(1rem, 1.5vw, 1.1rem);
  --font-size-lg: clamp(1.5rem, 2.5vw, 2rem);
  --font-size-xl: clamp(2rem, 4vw, 3rem);
}

*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-system);
  font-size: var(--font-size-base);
  line-height: 1.6;
  background: var(--bg-light);
  color: var(--fg-dark);
}

/* — Mode sombre (optionnel) */
/* Pour utiliser un thème sombre, ajouter la classe .theme-dark sur html ou body */
.theme-dark {
  background: var(--bg-dark);
  color: var(--fg-light);
}
.theme-dark a {
  color: var(--brand-secondary);
}

.container {
  max-width: 1080px;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--space);
  padding-right: var(--space);
}

.grid {
  display: grid;
  gap: var(--space);
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space);
}
@media (min-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}

.section {
  padding-top: calc(var(--space) * 2);
  padding-bottom: calc(var(--space) * 2);
}

.card {
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius);
  padding: var(--space);
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.2rem;
  border-radius: var(--radius);
  background: var(--accent-gradient);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn:hover,
.btn:focus {
  opacity: 0.85;
}

h1 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space);
}
h2 {
  font-size: var(--font-size-lg);
  margin-bottom: calc(var(--space) * 0.75);
}
h3 {
  font-size: clamp(1.25rem, 2vw, 1.5rem);
  margin-bottom: calc(var(--space) * 0.5);
}

p {
  margin-bottom: var(--space);
}

a {
  color: var(--brand-primary);
  text-decoration: none;
}
a:hover,
a:focus {
  text-decoration: underline;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: var(--radius);
}

/* Utility classes */
.text-center {
  text-align: center;
}
.flex {
  display: flex;
  gap: var(--space);
}
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.mt-0 { margin-top: 0; }
.mb-0 { margin-bottom: 0; }
.pb-0 { padding-bottom: 0; }

/* Accessibility helpers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

/* Default form styles */
input, textarea, select, button {
  font-family: var(--font-system);
  font-size: var(--font-size-base);
  padding: 0.75rem 1rem;
  border: 1px solid var(--muted-dark);
  border-radius: var(--radius);
  background: var(--bg-light);
  color: var(--fg-dark);
}
input:focus, textarea:focus, select:focus, button:focus {
  outline: 3px solid var(--brand-primary);
  outline-offset: 2px;
}

/* Responsive iframe/video */
.embed-responsive {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 aspect */
}
.embed-responsive iframe,
.embed-responsive video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Print styles */
@media print {
  body {
    background: #fff;
    color: #000;
  }
  a::after {
    content: " (" attr(href) ")";
  }
}

</style>`
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
