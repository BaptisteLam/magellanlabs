import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  path: string;
  content: string;
  type: string;
}

// Parser intelligent pour extraire les fichiers du code généré
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Détection des blocs de code avec chemins de fichiers
  // Format: ```filename:path/to/file.ext
  const fileBlockRegex = /```(?:[\w]+)?:?([\w/.]+)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = fileBlockRegex.exec(code)) !== null) {
    const [, path, content] = match;
    const extension = path.split('.').pop() || '';
    
    files.push({
      path: path.trim(),
      content: content.trim(),
      type: getFileType(extension)
    });
  }
  
  // Si aucun fichier trouvé avec le format structuré, chercher du HTML standalone
  if (files.length === 0 && (code.includes('<!DOCTYPE html>') || code.includes('<html'))) {
    const htmlContent = code.replace(/```html\n?|```\n?/g, '').trim();
    files.push({
      path: 'index.html',
      content: htmlContent,
      type: 'html'
    });
  }
  
  return files;
}

function getFileType(extension: string): string {
  const typeMap: Record<string, string> = {
    'html': 'html',
    'htm': 'html',
    'css': 'stylesheet',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'md': 'markdown',
    'txt': 'text'
  };
  
  return typeMap[extension.toLowerCase()] || 'text';
}

// Détecte la structure du projet
function detectProjectStructure(files: ProjectFile[]): string {
  const paths = files.map(f => f.path);
  
  if (paths.some(p => p.includes('package.json'))) {
    if (paths.some(p => p.includes('next.config'))) return 'nextjs';
    if (paths.some(p => p.includes('vite.config'))) return 'react';
    if (paths.some(p => p.includes('vue.config'))) return 'vue';
    return 'react';
  }
  
  return 'html';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, sessionId } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-site] User ${user.id} generating site for session ${sessionId}`);

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Prompt système optimisé pour la génération de structure de fichiers
    const systemPrompt = `Tu es un expert en développement web. 

IMPORTANT: Tu dois générer un projet web complet avec une structure de fichiers claire.

Format de réponse OBLIGATOIRE:
1. Commence par [EXPLANATION]courte description du projet[/EXPLANATION]
2. Ensuite, génère chaque fichier avec ce format exact:

\`\`\`html:index.html
<!DOCTYPE html>
<html>
...
</html>
\`\`\`

\`\`\`css:styles/main.css
body {
  ...
}
\`\`\`

\`\`\`javascript:scripts/app.js
console.log('Hello');
\`\`\`

Règles:
- Structure claire: index.html, styles/, scripts/, assets/
- Utilise Tailwind CDN si demandé
- Code moderne et professionnel
- Responsive design
- Maximum 4 images (Unsplash/Pexels)`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    // Appel OpenRouter avec streaming
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages,
        stream: true,
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-site] OpenRouter error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream SSE avec parsing en temps réel
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let accumulated = '';
        let lastParsedFiles: ProjectFile[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              if (dataStr === '[DONE]') {
                // Parsing final et sauvegarde
                const finalFiles = parseGeneratedCode(accumulated);
                const projectType = detectProjectStructure(finalFiles);
                
                // Sauvegarder dans Supabase
                if (sessionId) {
                  await supabaseClient
                    .from('build_sessions')
                    .update({
                      project_files: finalFiles,
                      project_type: projectType,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', sessionId);
                }

                // Envoyer événement de fin avec les fichiers finaux
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'done',
                  files: finalFiles,
                  projectType
                })}\n\n`));
                
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;

                // Parser en temps réel pour détecter les fichiers au fur et à mesure
                const currentFiles = parseGeneratedCode(accumulated);
                
                // Envoyer seulement les nouveaux fichiers ou les mises à jour
                if (currentFiles.length > lastParsedFiles.length || 
                    JSON.stringify(currentFiles) !== JSON.stringify(lastParsedFiles)) {
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'delta',
                    content: delta,
                    files: currentFiles
                  })}\n\n`));
                  
                  lastParsedFiles = currentFiles;
                } else {
                  // Envoyer juste le delta de texte
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'delta',
                    content: delta
                  })}\n\n`));
                }
              } catch (e) {
                console.error('[generate-site] Parse error:', e);
              }
            }
          }
        } catch (error) {
          console.error('[generate-site] Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[generate-site] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
