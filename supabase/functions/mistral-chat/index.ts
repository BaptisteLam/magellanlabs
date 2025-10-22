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

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY is not configured");
    }

    console.log("Calling OpenRouter API with messages:", messages);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trinitystudio.fr",
        "X-Title": "Trinity Studio AI",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-small-3.2-24b-instruct",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are Mistral Small 3.2 with the "Landing Page Builder" capability.

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
`,
          },
          ...messages,
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

    const generatedText = data.choices[0].message.content;

    const BASE_STYLE = `
<style>
:root {
  --brand: #2563eb;
  --bg: #0f172a;
  --fg: #f8fafc;
  --muted: #94a3b8;
  --radius: 14px;
  --space: clamp(12px, 2vw, 24px);
  --font: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
*,
*::before,
*::after { box-sizing: border-box; }
html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  line-height: 1.6;
}
.container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 var(--space);
}
.grid { display: grid; gap: var(--space); }
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space);
}
@media(min-width: 900px) {
  .grid-2 { grid-template-columns: 1fr 1fr; }
}
.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius);
  padding: var(--space);
}
.btn {
  display: inline-block;
  padding: 0.75rem 1.2rem;
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--brand), #60a5fa);
  color: white;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn:hover { opacity: 0.85; }
h1, h2, h3 { line-height: 1.2; margin-bottom: 0.5em; }
a { color: var(--brand); }
img { max-width: 100%; border-radius: var(--radius); }
</style>
`;

    // 💡 Étape 2 : injecter le style si manquant
    if (!/<style>[\s\S]*<\/style>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${BASE_STYLE}`);
    }

    // ♿ Étape 3 : petite vérif accessibilité de base
    function checkSEO(html: string) {
      const errors: string[] = [];
      if (!/<h1[^>]*>[\s\S]*<\/h1>/i.test(html)) errors.push("❌ Pas de <h1>");
      if (!/<title>[\s\S]*<\/title>/i.test(html)) errors.push("❌ Pas de <title>");
      if (!/<meta name="description"/i.test(html)) errors.push("❌ Pas de meta description");
      const imgs = html.match(/<img(?![^>]*alt=)[^>]*>/gi);
      if (imgs?.length) errors.push(`⚠️ ${imgs.length} image(s) sans alt`);
      return errors;
    }

    const checks = checkSEO(html);
    if (checks.length) console.warn("SEO/A11y checks:", checks);

    return new Response(JSON.stringify({ response: generatedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in mistral-chat function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
