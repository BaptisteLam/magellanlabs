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

// Parser pour extraire les fichiers modifiés
function parseModifiedFiles(code: string, existingFiles: ProjectFile[]): ProjectFile[] {
  const modifiedFiles: ProjectFile[] = [];
  
  // Détection des blocs de code avec chemins de fichiers
  const fileBlockRegex = /```(?:[\w]+)?:?([\w/.]+)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = fileBlockRegex.exec(code)) !== null) {
    const [, path, content] = match;
    const extension = path.split('.').pop() || '';
    
    modifiedFiles.push({
      path: path.trim(),
      content: content.trim(),
      type: getFileType(extension)
    });
  }
  
  // Fusionner avec les fichiers existants
  const fileMap = new Map<string, ProjectFile>();
  
  // D'abord, ajouter tous les fichiers existants
  existingFiles.forEach(file => {
    fileMap.set(file.path, file);
  });
  
  // Ensuite, mettre à jour ou ajouter les fichiers modifiés
  modifiedFiles.forEach(file => {
    fileMap.set(file.path, file);
  });
  
  return Array.from(fileMap.values());
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

    const { prompt, sessionId, currentFiles } = await req.json();

    if (!prompt || !sessionId || !currentFiles) {
      return new Response(
        JSON.stringify({ error: 'Prompt, sessionId, and currentFiles are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[modify-site] User ${user.id} modifying session ${sessionId}`);

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Créer un contexte des fichiers actuels
    const filesContext = currentFiles.map((f: ProjectFile) => 
      `\`\`\`${getLanguageFromType(f.type)}:${f.path}\n${f.content}\n\`\`\``
    ).join('\n\n');

    // Prompt système pour les modifications
    const systemPrompt = `Tu es un expert en développement web qui modifie des projets existants.

IMPORTANT: Renvoie UNIQUEMENT les fichiers qui ont été modifiés avec ce format exact:

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

Règles:
- Renvoie SEULEMENT les fichiers modifiés
- Garde la même structure de projet
- Applique exactement les modifications demandées
- Code professionnel et maintenable`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Fichiers actuels du projet:\n\n${filesContext}\n\nModification à appliquer:\n${prompt}`
      }
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
        max_tokens: 6000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[modify-site] OpenRouter error:', response.status, errorText);
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
        let lastModifiedFiles: ProjectFile[] = [];

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
                // Parsing final et fusion avec les fichiers existants
                const updatedFiles = parseModifiedFiles(accumulated, currentFiles);
                
                // Sauvegarder dans Supabase
                await supabaseClient
                  .from('build_sessions')
                  .update({
                    project_files: updatedFiles,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', sessionId);

                // Envoyer événement de fin avec tous les fichiers mis à jour
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'done',
                  files: updatedFiles,
                  modifiedPaths: lastModifiedFiles.map(f => f.path)
                })}\n\n`));
                
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;

                // Parser en temps réel pour détecter les fichiers modifiés
                const currentModified = parseModifiedFiles(accumulated, currentFiles);
                const modifiedOnly = currentModified.filter(f => 
                  !currentFiles.some((cf: ProjectFile) => 
                    cf.path === f.path && cf.content === f.content
                  )
                );
                
                if (modifiedOnly.length > lastModifiedFiles.length || 
                    JSON.stringify(modifiedOnly) !== JSON.stringify(lastModifiedFiles)) {
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'delta',
                    content: delta,
                    modifiedFiles: modifiedOnly,
                    allFiles: currentModified
                  })}\n\n`));
                  
                  lastModifiedFiles = modifiedOnly;
                } else {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'delta',
                    content: delta
                  })}\n\n`));
                }
              } catch (e) {
                console.error('[modify-site] Parse error:', e);
              }
            }
          }
        } catch (error) {
          console.error('[modify-site] Stream error:', error);
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
    console.error('[modify-site] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getLanguageFromType(type: string): string {
  const langMap: Record<string, string> = {
    'html': 'html',
    'stylesheet': 'css',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'json': 'json',
    'markdown': 'markdown'
  };
  
  return langMap[type] || 'text';
}
