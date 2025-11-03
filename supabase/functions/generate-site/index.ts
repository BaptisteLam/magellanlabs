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

// Parser pour extraire les fichiers - format amélioré
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Format 1: // FILE: path
  const fileRegex = /\/\/\s*FILE:\s*(.+?)\n([\s\S]*?)(?=\/\/\s*FILE:|$)/g;
  let match;
  
  while ((match = fileRegex.exec(code)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    
    if (content && content.length > 0) {
      const extension = filePath.split('.').pop() || '';
      files.push({
        path: filePath,
        content: content,
        type: getFileType(extension)
      });
    }
  }
  
  // Format 2: ```language // filepath
  if (files.length === 0) {
    const codeBlockRegex = /```(\w+)?\s*(?:\/\/|#)?\s*(.+?)\n([\s\S]*?)```/g;
    
    while ((match = codeBlockRegex.exec(code)) !== null) {
      const [, language, filepath, content] = match;
      const cleanPath = filepath.trim();
      const cleanContent = content.trim();
      
      if (cleanContent && cleanContent.length > 0) {
        const extension = cleanPath.split('.').pop() || language || '';
        files.push({
          path: cleanPath,
          content: cleanContent,
          type: getFileType(extension)
        });
      }
    }
  }
  
  // Format 3: JSON structure { "files": { "path": "content" } }
  if (files.length === 0) {
    try {
      const jsonMatch = code.match(/\{[\s\S]*"files"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.files && typeof parsed.files === 'object') {
          for (const [path, content] of Object.entries(parsed.files)) {
            if (typeof content === 'string' && content.length > 0) {
              const extension = path.split('.').pop() || '';
              files.push({
                path,
                content: content.trim(),
                type: getFileType(extension)
              });
            }
          }
        }
      }
    } catch (e) {
      // Pas de JSON valide
    }
  }
  
  // Fallback: HTML standalone
  if (files.length === 0 && (code.includes('<!DOCTYPE html>') || code.includes('<html'))) {
    const htmlContent = code.replace(/```html\n?|```\n?/g, '').trim();
    if (htmlContent.length > 0) {
      files.push({
        path: 'index.html',
        content: htmlContent,
        type: 'html'
      });
    }
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

    // Prompt système optimisé pour génération multi-fichiers structurée
    const systemPrompt = `Tu es un expert développeur web fullstack. Génère un projet web complet, moderne et professionnel.

📋 RÈGLES DE GÉNÉRATION :

1. **Structure Multi-Fichiers** : Génère TOUS les fichiers nécessaires pour un projet fonctionnel
2. **Format de Sortie** : Utilise le format // FILE: chemin/fichier pour CHAQUE fichier
3. **Qualité Professionnelle** : Code propre, commenté, maintenable, moderne
4. **Technologies** : React + TypeScript + Vite + Tailwind CSS (ou HTML/CSS/JS selon le contexte)
5. **Design** : Interface moderne, responsive, animations fluides

📦 FICHIERS OBLIGATOIRES (selon type de projet) :

**Pour React/Vite :**
// FILE: package.json
{
  "name": "project-name",
  "type": "module",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.0",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.1"
  }
}

// FILE: vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})

// FILE: tailwind.config.ts
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} }
}

// FILE: index.html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>

// FILE: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// FILE: src/App.tsx
import React from 'react'
import Header from './components/Header'
import Hero from './components/Hero'

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
    </div>
  )
}

// FILE: src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

// FILE: src/components/Header.tsx
export default function Header() { ... }

// FILE: src/components/Hero.tsx
export default function Hero() { ... }

**Pour HTML/CSS/JS :**
// FILE: index.html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script src="script.js"></script>
</body>
</html>

// FILE: style.css
/* Animations et styles custom */
@keyframes fadeIn { ... }

// FILE: script.js
// Interactivité JavaScript

✨ IMPORTANT :
- Génère du contenu COMPLET dans chaque fichier (pas de placeholders)
- Sépare les composants/sections en fichiers distincts
- Inclus animations, interactions, responsive design
- Code TypeScript typé si React
- Utilise Tailwind CSS + CSS custom pour animations
- Minimum 5 fichiers pour un projet professionnel

Réponds UNIQUEMENT avec les fichiers au format // FILE: sans explication avant ou après.`;

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
        model: 'anthropic/claude-sonnet-4-20250514',
        messages,
        stream: true,
        max_tokens: 32000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-site] OpenRouter error:', response.status, errorText);
      
      // Return generic error message to user
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        402: 'Insufficient credits. Please try again later.',
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
                const delta = json?.choices?.[0]?.delta?.content || '';
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
