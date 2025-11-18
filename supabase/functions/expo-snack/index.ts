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
    const { files, sessionId } = await req.json();

    if (!files || !sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert files object to Snack format
    const snackFiles: Record<string, { type: string; contents: string }> = {};
    
    for (const [path, content] of Object.entries(files)) {
      snackFiles[path] = {
        type: "CODE",
        contents: content as string
      };
    }

    // Create Snack via API
    const snackResponse = await fetch("https://expo.dev/api/v2/snack/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Mobile App - ${sessionId.substring(0, 8)}`,
        files: snackFiles,
        dependencies: {
          "expo": "~52.0.0",
          "expo-router": "~4.0.0",
          "react": "18.3.1",
          "react-native": "0.76.5",
          "nativewind": "^4.0.0",
          "react-native-reanimated": "~3.16.1",
          "react-native-safe-area-context": "4.12.0",
          "react-native-screens": "~4.3.0"
        },
        sdkVersion: "52.0.0"
      })
    });

    if (!snackResponse.ok) {
      const errorText = await snackResponse.text();
      console.error("Expo Snack API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create Expo Snack" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const snackData = await snackResponse.json();
    
    // Generate URLs
    const snackId = snackData.id;
    const previewUrl = `https://snack.expo.dev/${snackId}`;
    const embedUrl = `https://snack.expo.dev/embedded/${snackId}?preview=true&platform=ios`;
    const qrUrl = `exp://exp.host/@snack/${snackId}`;

    return new Response(
      JSON.stringify({
        success: true,
        previewUrl,
        embedUrl,
        qrUrl,
        snackId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Expo Snack function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
