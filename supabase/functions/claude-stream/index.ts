import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { system, messages, isModification } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    console.log(`[claude-stream] ${isModification ? 'Modification' : 'Génération'} with ${messages.length} messages`);
    console.log(`[claude-stream] Request received at ${new Date().toISOString()}`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: isModification ? 8000 : 16384,
        stream: true,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[claude-stream] Anthropic API error:", response.status, errorText);
      
      // Return generic error message to user
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        429: 'Too many requests. Please try again in a few moments.',
        500: 'An unexpected error occurred. Please try again later.'
      };
      
      throw new Error(statusMessages[response.status] || 'Request failed. Please try again later.');
    }

    console.log("[claude-stream] ✅ Streaming response started");

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Wrapper pour logger le contenu streamé
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk);
        
        // Log un échantillon du contenu streamé (pas tout pour éviter de surcharger les logs)
        if (text.includes("data: ") && !text.includes("[DONE]")) {
          try {
            const lines = text.split('\n').filter(l => l.startsWith('data: '));
            for (const line of lines) {
              const jsonStr = line.replace('data: ', '').trim();
              if (jsonStr && jsonStr !== '[DONE]') {
                const parsed = JSON.parse(jsonStr);
                const content = parsed?.delta?.text || parsed?.content_block?.text || '';
                if (content) {
                  console.log(`[claude-stream] 📝 Content chunk: ${content.substring(0, 100)}...`);
                }
              }
            }
          } catch (e) {
            // Ignore parse errors in logging
          }
        }
        
        controller.enqueue(chunk);
      }
    });

    // Stream directement la réponse avec logging
    return new Response(response.body.pipeThrough(transformStream), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in claude-stream:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Request failed. Please try again later." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
