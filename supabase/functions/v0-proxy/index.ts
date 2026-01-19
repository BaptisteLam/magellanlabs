import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limits by user type
const RATE_LIMITS = {
  anonymous: 3,
  guest: 5,
  registered: 50,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const v0ApiKey = Deno.env.get('V0_API_KEY');

    if (!v0ApiKey) {
      console.error('[v0-proxy] V0_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'V0 API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    let userId: string | null = null;
    let userType: 'anonymous' | 'guest' | 'registered' = 'anonymous';

    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userType = 'registered';
      }
    }

    // Rate limiting
    const limit = RATE_LIMITS[userType];
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    if (userType === 'anonymous') {
      // Rate limit by IP for anonymous users
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count } = await supabase
        .from('anonymous_chat_log')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', clientIp)
        .gte('created_at', oneDayAgo);

      if (count !== null && count >= limit) {
        console.log(`[v0-proxy] Rate limit exceeded for IP: ${clientIp}`);
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Les utilisateurs anonymes sont limités à ${limit} générations par jour. Inscrivez-vous pour plus de générations.`,
            limit,
            used: count,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (userId) {
      // Rate limit for registered users
      const { data: rateLimit } = await supabase
        .from('user_rate_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (rateLimit) {
        const resetTime = new Date(rateLimit.last_reset);
        const now = new Date();
        const hoursSinceReset = (now.getTime() - resetTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceReset >= 24) {
          // Reset counter
          await supabase
            .from('user_rate_limits')
            .update({ chats_today: 1, last_reset: now.toISOString() })
            .eq('user_id', userId);
        } else if (rateLimit.chats_today >= limit) {
          const hoursRemaining = Math.ceil(24 - hoursSinceReset);
          return new Response(
            JSON.stringify({
              error: 'Rate limit exceeded',
              message: `Vous avez atteint votre limite quotidienne de ${limit} générations. Réinitialisation dans ${hoursRemaining}h.`,
              limit,
              used: rateLimit.chats_today,
              resetIn: hoursRemaining,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Increment counter
          await supabase
            .from('user_rate_limits')
            .update({ chats_today: rateLimit.chats_today + 1 })
            .eq('user_id', userId);
        }
      } else {
        // First usage - create rate limit entry
        await supabase.from('user_rate_limits').insert({
          user_id: userId,
          chats_today: 1,
          last_reset: new Date().toISOString(),
        });
      }
    }

    // Parse request
    const { 
      prompt, 
      chatId, 
      projectFiles, 
      attachedFiles,
      projectType = 'website',
      stream = true,
      model = 'v0-1.5-md'
    } = await req.json();

    console.log(`[v0-proxy] Request: userType=${userType}, model=${model}, stream=${stream}`);

    // Build messages for V0 API
    const messages: any[] = [];

    // System message
    messages.push({
      role: 'system',
      content: `Tu es un expert en développement web. Génère du code moderne, responsive et propre.
Type de projet: ${projectType}
Format de sortie: Utilise le format "// FILE: path/to/file.ext" pour délimiter chaque fichier.
Langues: Génère le contenu en français sauf si explicitement demandé autrement.
Style: Utilise des couleurs modernes, du CSS Grid/Flexbox, et des animations subtiles.`
    });

    // Add project context if modifying
    if (projectFiles && Object.keys(projectFiles).length > 0) {
      const filesContext = Object.entries(projectFiles)
        .map(([path, content]) => `// FILE: ${path}\n${content}`)
        .join('\n\n---\n\n');
      
      messages.push({
        role: 'system',
        content: `Fichiers du projet actuel:\n\n${filesContext}`
      });
    }

    // User message with optional images
    if (attachedFiles && attachedFiles.length > 0) {
      const content: any[] = [{ type: 'text', text: prompt }];
      
      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/')) {
          content.push({
            type: 'image_url',
            image_url: { url: file.base64 }
          });
        }
      }
      
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    // Call V0 API
    const v0Response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${v0ApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        max_completion_tokens: 8000,
      }),
    });

    if (!v0Response.ok) {
      const errorText = await v0Response.text();
      console.error(`[v0-proxy] V0 API error: ${v0Response.status}`, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'V0 API error', 
          status: v0Response.status,
          details: errorText 
        }),
        { status: v0Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log usage for anonymous users
    if (userType === 'anonymous') {
      await supabase.from('anonymous_chat_log').insert({
        ip_address: clientIp,
        v0_chat_id: chatId || `anon_${Date.now()}`,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[v0-proxy] V0 API responded in ${duration}ms`);

    if (stream) {
      // Return streaming response
      return new Response(v0Response.body, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Return JSON response
      const v0Data = await v0Response.json();
      
      // Extract content
      const content = v0Data.choices?.[0]?.message?.content || '';
      
      // Parse files from content
      const files = parseFilesFromContent(content);

      return new Response(
        JSON.stringify({
          success: true,
          chatId: v0Data.id || chatId || `v0_${Date.now()}`,
          messageId: v0Data.id,
          content,
          files,
          model: v0Data.model,
          usage: v0Data.usage,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[v0-proxy] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseFilesFromContent(content: string): Record<string, string> {
  const files: Record<string, string> = {};
  
  // Pattern: // FILE: path/to/file.ext
  const fileRegex = /\/\/ FILE: ([^\n]+)\n([\s\S]*?)(?=\/\/ FILE:|$)/g;
  
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const path = match[1].trim();
    const fileContent = match[2].trim();
    if (path && fileContent) {
      files[path] = fileContent;
    }
  }

  // If no files found, try code blocks
  if (Object.keys(files).length === 0) {
    const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
    const cssMatch = content.match(/```css\n([\s\S]*?)```/);
    const jsMatch = content.match(/```(?:javascript|js)\n([\s\S]*?)```/);

    if (htmlMatch) files['index.html'] = htmlMatch[1].trim();
    if (cssMatch) files['styles.css'] = cssMatch[1].trim();
    if (jsMatch) files['app.js'] = jsMatch[1].trim();
  }

  return files;
}
