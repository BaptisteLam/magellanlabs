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
  
  // Format 1: // FILE: path suivi du contenu (avec ou sans code blocks)
  const fileRegex = /\/\/\s*FILE:\s*(.+?)(?:\n|$)/g;
  const matches = [...code.matchAll(fileRegex)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filePath = match[1].trim();
    const startIndex = match.index! + match[0].length;
    
    // Trouve le contenu jusqu'au prochain fichier
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : code.length;
    let rawContent = code.slice(startIndex, endIndex).trim();
    
    // Nettoyer les code blocks markdown si présents
    // Exemples: ```json ... ```, ```typescript ... ```, etc.
    const codeBlockMatch = rawContent.match(/^```[\w]*\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      rawContent = codeBlockMatch[1].trim();
    }
    
    const extension = filePath.split('.').pop() || '';
    
    files.push({
      path: filePath,
      content: rawContent,
      type: getFileType(extension)
    });
  }
  
  // Format 2: code blocks avec nom de fichier (```json:package.json)
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
  
  // Format 3: HTML standalone sans markers
  if (files.length === 0 && (code.includes('<!DOCTYPE html>') || code.includes('<html'))) {
    let htmlContent = code;
    
    // Retirer tous les code blocks markdown
    htmlContent = htmlContent.replace(/```html\n?/g, '');
    htmlContent = htmlContent.replace(/```\n?/g, '');
    htmlContent = htmlContent.trim();
    
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Prompt système optimisé pour génération de projets web modernes multi-fichiers
    const systemPrompt = `Tu es un expert développeur web fullstack spécialisé dans la création de projets web complets, visuellement impressionnants et professionnels.

RÈGLES ABSOLUES DE GÉNÉRATION :
1. **CONTENU RICHE ET COMPLET OBLIGATOIRE** : Tu DOIS créer des sites avec du vrai contenu substantiel (minimum 200+ lignes de code HTML/JSX)
2. **INTERDICTION DE CONTENU MINIMAL** : Ne JAMAIS générer juste "Hello World" ou des pages avec 2-3 éléments
3. **DESIGN PROFESSIONNEL** : Chaque site doit être visuellement attrayant avec des sections complètes, animations, gradients, etc.

ARCHITECTURE PAR DÉFAUT :
- Génère des projets React/Vite avec TypeScript pour toute demande nécessitant interactivité ou complexité
- Génère du HTML pur enrichi (avec CSS avancé et JavaScript vanilla) pour les landing pages simples
- TOUJOURS inclure plusieurs sections : Hero, Features, About, Services, Testimonials, Footer, etc.

STRUCTURE OBLIGATOIRE POUR REACT/VITE :
// FILE: package.json
{
  "name": "projet-moderne",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}

// FILE: index.html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Projet Moderne</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

// FILE: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// FILE: src/App.tsx
[Composant principal avec PLUSIEURS sections complètes - minimum 100+ lignes]

// FILE: src/index.css
[Styles CSS avancés : variables CSS, gradients, animations, responsive - minimum 50+ lignes]

// FILE: src/components/[Composant].tsx
[Au moins 2-3 composants réutilisables]

POUR HTML PUR (Landing pages simples) :
// FILE: index.html
[HTML complet avec header, hero, features, testimonials, footer - minimum 200+ lignes]

// FILE: style.css
[CSS moderne avec animations, gradients, responsive - minimum 100+ lignes]

// FILE: script.js
[JavaScript vanilla pour interactions - minimum 30+ lignes]

FORMAT DE SORTIE (OBLIGATOIRE) :
Chaque fichier DOIT être précédé de :
// FILE: chemin/complet/fichier.extension

EXIGENCES DE QUALITÉ :
✅ Design moderne avec gradients, ombres, animations CSS
✅ Responsive mobile-first (breakpoints tablet et desktop)
✅ Typographie élégante avec hiérarchie claire
✅ Palette de couleurs harmonieuse (3-5 couleurs)
✅ Contenu textuel réaliste et substantiel (pas de lorem ipsum sauf si approprié)
✅ Images placeholders bien intégrées
✅ Interactions utilisateur fluides (hover, focus, smooth scroll)

❌ INTERDIT :
- Pages avec moins de 100 lignes de code total
- "Hello World" ou contenu minimaliste
- Design basique sans style
- Absence de sections multiples

Génère maintenant un projet web complet, professionnel et visuellement impressionnant.`;

    // Appel Lovable AI Gateway avec Gemini Flash (plus rapide)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 8000,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-site] Lovable AI error:', response.status, errorText);
      
      // Return generic error message to user
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        402: 'Credits required. Please add credits to your Lovable AI workspace.',
        429: 'Rate limit exceeded. Please try again in a few moments.',
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

        let streamClosed = false; // Flag pour éviter d'enqueuer après fermeture

        const safeEnqueue = (data: Uint8Array) => {
          if (!streamClosed) {
            try {
              controller.enqueue(data);
            } catch (e) {
              console.error('[generate-site] Enqueue error:', e);
              streamClosed = true;
            }
          }
        };

        const closeStream = () => {
          if (!streamClosed) {
            streamClosed = true;
            try {
              reader.cancel();
            } catch (e) {
              console.error('[generate-site] Reader cancel error:', e);
            }
            try {
              controller.close();
            } catch (e) {
              console.error('[generate-site] Controller close error:', e);
            }
          }
        };

        // Event: start
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
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
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: 'Timeout: La génération a pris trop de temps. Veuillez réessayer.' }
          })}\n\n`));
          closeStream();
        }, 360000);

        try {
          while (!streamClosed) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (streamClosed) break;
              
              if (!line.trim() || line.startsWith(':') || line === '') continue;
              
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              if (dataStr === '[DONE]') {
                if (timeout) clearTimeout(timeout);
                
                // ✅ VALIDATION DU CONTENU FINAL
                console.log(`[generate-site] 📏 Final accumulated content: ${accumulated.length} characters`);
                
                if (!accumulated || accumulated.trim().length === 0) {
                  console.error("[generate-site] ❌ ERROR: Accumulated content is empty!");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Le contenu généré est vide — génération échouée' }
                  })}\n\n`));
                  closeStream();
                  return;
                }

                if (accumulated.length < 100) {
                  console.error(`[generate-site] ❌ ERROR: Content too short (${accumulated.length} chars)`);
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: `Contenu trop court (${accumulated.length} caractères) — génération échouée` }
                  })}\n\n`));
                  closeStream();
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
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      data: { message: `HTML trop court (${htmlContent.length} caractères) — génération échouée` }
                    })}\n\n`));
                    closeStream();
                    return;
                  }

                  // Vérifier les balises essentielles
                  const hasHtml = htmlContent.includes('<html');
                  const hasHead = htmlContent.includes('<head');
                  const hasBody = htmlContent.includes('<body');
                  
                  console.log(`[generate-site] 🔍 HTML validation: <html>=${hasHtml}, <head>=${hasHead}, <body>=${hasBody}`);
                  
                  if (!hasHtml || !hasHead || !hasBody) {
                    console.error("[generate-site] ❌ ERROR: Missing essential HTML tags");
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      data: { message: 'HTML invalide - balises essentielles manquantes (<html>, <head>, ou <body>)' }
                    })}\n\n`));
                    closeStream();
                    return;
                  }

                  console.log(`[generate-site] ✅ index.html validated successfully (${htmlContent.length} chars)`);
                } else {
                  console.error("[generate-site] ❌ ERROR: No index.html file found in parsed files");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Aucun fichier index.html trouvé — génération échouée' }
                  })}\n\n`));
                  closeStream();
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
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: { totalFiles: finalFiles.length, projectType }
                })}\n\n`));
                
                closeStream();
                return;
              }

              try {
                const json = JSON.parse(dataStr);
                // Support OpenAI-compatible streaming format (Lovable AI)
                const delta = json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;
                
                // Event: chunk (streaming progressif)
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk',
                  data: { content: delta }
                })}\n\n`));

                // Parser optimisé: seulement tous les 500 caractères
                if (accumulated.length % 500 < delta.length) {
                  const currentFiles = parseGeneratedCode(accumulated);
                  
                  // Détecte les nouveaux fichiers
                  if (currentFiles.length > lastParsedFiles.length) {
                    const newFiles = currentFiles.slice(lastParsedFiles.length);
                    
                    for (const file of newFiles) {
                      // Event: file_detected
                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'file_detected',
                        data: { path: file.path, content: file.content, type: file.type }
                      })}\n\n`));
                    }
                    
                    lastParsedFiles = currentFiles;
                  }
                }
              } catch (e) {
                console.error('[generate-site] Parse error:', e);
              }
            }
          }
          
          // Si on sort de la boucle sans avoir reçu [DONE]
          if (!streamClosed) {
            if (timeout) clearTimeout(timeout);
            closeStream();
          }
        } catch (error) {
          if (timeout) clearTimeout(timeout);
          console.error('[generate-site] Stream error:', error);
          
          // Event: error
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Erreur inconnue' }
          })}\n\n`));
          
          closeStream();
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
