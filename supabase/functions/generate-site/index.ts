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
    'txt': 'text',
    'svg': 'image',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'webp': 'image',
    'ico': 'image',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'env': 'text'
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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Prompt système optimisé pour génération de projets web modernes
    const systemPrompt = `Tu es un expert développeur web fullstack. Tu génères des projets web complets et modernes selon les besoins de l'utilisateur.

FORMATS SUPPORTÉS :
- Projets React/Vite avec TypeScript/JavaScript
- Sites HTML/CSS/JS statiques
- Applications avec JSON de configuration
- Tout autre format pertinent selon le besoin

RÈGLES DE GÉNÉRATION :
1. Choisis l'architecture la plus adaptée à la demande (React/Vite pour apps complexes, HTML simple pour sites basiques)
2. Génère TOUS les fichiers nécessaires au projet
3. Code propre, moderne, responsive
4. Utilise les meilleures pratiques (TypeScript, composants modulaires, etc.)
5. Inclus uniquement ce qui est demandé, pas de fonctionnalités superflues

FORMAT DE SORTIE (OBLIGATOIRE) :
Utilise exactement ce format pour chaque fichier :
// FILE: chemin/vers/fichier.ext
[contenu du fichier]

Exemples :
// FILE: src/App.tsx
// FILE: index.html
// FILE: package.json
// FILE: style.css

TYPES DE PROJETS :

Pour une application React/Vite moderne :
- package.json avec dépendances
- index.html
- src/main.tsx ou src/main.jsx
- src/App.tsx ou src/App.jsx
- src/components/*.tsx
- src/index.css
- vite.config.ts si nécessaire

Pour un site HTML simple :
- index.html
- style.css
- script.js

IMPORTANT :
- Génère du code COMPLET et FONCTIONNEL
- Pas de placeholders ou de commentaires "// TODO"
- Chaque fichier doit être prêt à l'emploi
- Adapte la complexité à la demande de l'utilisateur

Génère maintenant le projet demandé avec TOUS les fichiers nécessaires.`;

    // Appel Anthropic API directe avec streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        stream: true,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-site] Anthropic API error:', response.status, errorText);
      
      // Return generic error message to user
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        429: 'Too many requests. Please try again in a few moments.',
        500: 'An unexpected error occurred. Please try again later.'
      };
      
      return new Response(
        JSON.stringify({ error: statusMessages[response.status] || 'Request failed. Please try again later.' }),
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
              if (!line.trim() || line.startsWith(':') || line === '') continue;
              
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              if (dataStr === '[DONE]') {
                if (timeout) clearTimeout(timeout);
                
                // ✅ VALIDATION DU CONTENU FINAL
                console.log(`[generate-site] 📏 Final accumulated content: ${accumulated.length} characters`);
                
                if (!accumulated || accumulated.trim().length === 0) {
                  console.error("[generate-site] ❌ ERROR: Accumulated content is empty!");
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Le contenu généré est vide — génération échouée' }
                  })}\n\n`));
                  controller.close();
                  return;
                }

                if (accumulated.length < 100) {
                  console.error(`[generate-site] ❌ ERROR: Content too short (${accumulated.length} chars)`);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: `Contenu trop court (${accumulated.length} caractères) — génération échouée` }
                  })}\n\n`));
                  controller.close();
                  return;
                }

                console.log(`[generate-site] 🧠 Content preview (first 200 chars): ${accumulated.substring(0, 200)}...`);
                
                // Parsing final et sauvegarde
                const finalFiles = parseGeneratedCode(accumulated);
                const projectType = detectProjectStructure(finalFiles);
                
                console.log(`[generate-site] 📦 Parsed ${finalFiles.length} files, type: ${projectType}`);
                
                // ✅ VALIDATION STRICTE DU HTML
                const htmlFile = finalFiles.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'));
                if (htmlFile) {
                  const htmlContent = htmlFile.content;
                  console.log(`[generate-site] 📄 index.html size: ${htmlContent.length} characters`);
                  console.log(`[generate-site] 🧠 HTML preview (first 200 chars): ${htmlContent.substring(0, 200)}...`);
                  
                  if (htmlContent.length < 50) {
                    console.error(`[generate-site] ❌ ERROR: index.html too short (${htmlContent.length} chars)`);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      data: { message: `HTML trop court (${htmlContent.length} caractères) — génération échouée` }
                    })}\n\n`));
                    controller.close();
                    return;
                  }

                  // Vérifier les balises essentielles
                  const hasHtml = htmlContent.includes('<html');
                  const hasHead = htmlContent.includes('<head');
                  const hasBody = htmlContent.includes('<body');
                  
                  console.log(`[generate-site] 🔍 HTML validation: <html>=${hasHtml}, <head>=${hasHead}, <body>=${hasBody}`);
                  
                  if (!hasHtml || !hasHead || !hasBody) {
                    console.error("[generate-site] ❌ ERROR: Missing essential HTML tags");
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      data: { message: 'HTML invalide - balises essentielles manquantes (<html>, <head>, ou <body>)' }
                    })}\n\n`));
                    controller.close();
                    return;
                  }

                  console.log(`[generate-site] ✅ index.html validated successfully (${htmlContent.length} chars)`);
                } else {
                  console.error("[generate-site] ❌ ERROR: No index.html file found in parsed files");
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Aucun fichier index.html trouvé — génération échouée' }
                  })}\n\n`));
                  controller.close();
                  return;
                }
                
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
                // Support Anthropic streaming format
                const delta = json?.delta?.text || json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;
                
                // Log périodique de la taille accumulée (tous les 1000 caractères)
                if (accumulated.length % 1000 < delta.length) {
                  console.log(`[generate-site] 📊 Accumulated: ${accumulated.length} characters`);
                }

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
      JSON.stringify({ error: 'Request failed. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
