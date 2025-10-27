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

// Parser pour extraire les fichiers au format // FILE: path
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Détection du format // FILE: path
  const fileRegex = /\/\/\s*FILE:\s*(.+?)\n/g;
  const matches = [...code.matchAll(fileRegex)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filePath = match[1].trim();
    const startIndex = match.index! + match[0].length;
    
    // Trouve le contenu jusqu'au prochain fichier
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : code.length;
    const content = code.slice(startIndex, endIndex).trim();
    
    const extension = filePath.split('.').pop() || '';
    
    files.push({
      path: filePath,
      content: content,
      type: getFileType(extension)
    });
  }
  
  // Fallback: format ```type:path
  if (files.length === 0) {
    const codeBlockRegex = /```(?:[\w]+)?:?([\w/.]+)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(code)) !== null) {
      const [, path, content] = match;
      const extension = path.split('.').pop() || '';
      
      files.push({
        path: path.trim(),
        content: content.trim(),
        type: getFileType(extension)
      });
    }
  }
  
  // Fallback: HTML standalone
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

    // Prompt système optimisé pour React/TypeScript
    const systemPrompt = `Tu es un expert développeur React/TypeScript.
Génère un site web complet et fonctionnel.

RÈGLES IMPORTANTES :
1. Structure le projet avec src/, components/, utils/, styles/
2. Chaque fichier commence par : // FILE: [chemin/complet.tsx]
3. Utilise React 18 + TypeScript + Tailwind CSS
4. Code production-ready avec bonnes pratiques
5. Responsive design (mobile-first)
6. Composants réutilisables et bien nommés
7. Maximum 4 images (utilise Unsplash/Pexels URLs)

FORMAT ATTENDU :
// FILE: src/App.tsx
import React from 'react';
[...code...]

// FILE: src/components/Header.tsx
import React from 'react';
[...code...]

// FILE: src/styles/globals.css
[...styles...]

Génère TOUS les fichiers nécessaires pour un site complet.`;

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
        'HTTP-Referer': 'https://trinitystudio.ai',
        'X-Title': 'Trinity Studio AI',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages,
        stream: true,
        max_tokens: 100000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-site] OpenRouter error:', response.status, errorText);
      
      let errorMessage = 'AI API error';
      if (response.status === 429) {
        errorMessage = 'Rate limit dépassé. Veuillez réessayer dans quelques instants.';
      } else if (response.status === 401) {
        errorMessage = 'Clé API OpenRouter invalide. Veuillez vérifier vos paramètres.';
      } else if (response.status === 402) {
        errorMessage = 'Crédits OpenRouter insuffisants. Veuillez recharger votre compte.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream SSE avec parsing en temps réel et events structurés
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        // Event: start
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          data: { sessionId }
        })}\n\n`));

        const decoder = new TextDecoder();
        let accumulated = '';
        let lastParsedFiles: ProjectFile[] = [];
        let timeout: number | null = null;

        // Timeout de 360 secondes
        timeout = setTimeout(() => {
          console.error('[generate-site] Timeout après 360s');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: 'Timeout: La génération a pris trop de temps. Veuillez réessayer.' }
          })}\n\n`));
          controller.close();
        }, 360000);

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
                if (timeout) clearTimeout(timeout);
                
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

                // Event: complete
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: { totalFiles: finalFiles.length, projectType }
                })}\n\n`));
                
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;

                // Event: chunk
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk',
                  data: { content: delta }
                })}\n\n`));

                // Parser en temps réel pour détecter les fichiers
                const currentFiles = parseGeneratedCode(accumulated);
                
                // Détecte les nouveaux fichiers
                if (currentFiles.length > lastParsedFiles.length) {
                  const newFiles = currentFiles.slice(lastParsedFiles.length);
                  
                  for (const file of newFiles) {
                    // Event: file_detected
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'file_detected',
                      data: { path: file.path, content: file.content, type: file.type }
                    })}\n\n`));
                  }
                  
                  lastParsedFiles = currentFiles;
                }
              } catch (e) {
                console.error('[generate-site] Parse error:', e);
              }
            }
          }
        } catch (error) {
          if (timeout) clearTimeout(timeout);
          console.error('[generate-site] Stream error:', error);
          
          // Event: error
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Erreur inconnue' }
          })}\n\n`));
          
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
