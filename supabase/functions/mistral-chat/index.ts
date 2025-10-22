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
        "X-Title": "Trinity AI",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-small-3.2-24b-instruct",
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 8000,
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
2. Max 1500 lignes de HTML pour rester lisible.
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
