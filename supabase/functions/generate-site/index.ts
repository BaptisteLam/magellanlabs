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

interface GeneratedOutput {
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  metadata?: {
    title?: string;
    description?: string;
  };
}

// Nettoie le contenu d'un fichier des marqueurs markdown résiduels
function cleanFileContent(content: string): string {
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  cleaned = cleaned.replace(/^```\s*$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

function getFileType(extension: string): string {
  const typeMap: Record<string, string> = {
    'html': 'html',
    'htm': 'html',
    'css': 'stylesheet',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'svg': 'image',
  };
  return typeMap[extension.toLowerCase()] || 'text';
}

// Parser pour extraire les fichiers - supporte JSON et format legacy
function parseGeneratedCode(code: string): { files: ProjectFile[]; dependencies: Record<string, string>; metadata: any } {
  const files: ProjectFile[] = [];
  let dependencies: Record<string, string> = { "lucide-react": "^0.294.0" };
  let metadata: any = {};
  
  console.log('[parseGeneratedCode] Input length:', code.length);
  console.log('[parseGeneratedCode] First 500 chars:', code.substring(0, 500));
  
  let cleanedCode = code.trim();
  
  // Nettoyer les marqueurs markdown
  if (cleanedCode.startsWith('```json')) {
    cleanedCode = cleanedCode.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleanedCode.startsWith('```')) {
    cleanedCode = cleanedCode.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
  }
  
  // FORMAT 1: JSON structuré (nouveau format préféré)
  try {
    // Chercher un JSON valide dans la réponse
    const jsonMatch = cleanedCode.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: GeneratedOutput = JSON.parse(jsonMatch[0]);
      
      if (parsed.files && typeof parsed.files === 'object') {
        console.log('[parseGeneratedCode] Parsed JSON format successfully');
        
        Object.entries(parsed.files).forEach(([path, content]) => {
          // S'assurer que le chemin commence par /
          const normalizedPath = path.startsWith('/') ? path : '/' + path;
          const extension = normalizedPath.split('.').pop() || 'js';
          
          files.push({
            path: normalizedPath,
            content: cleanFileContent(content),
            type: getFileType(extension)
          });
        });
        
        if (parsed.dependencies) {
          dependencies = { ...dependencies, ...parsed.dependencies };
        }
        if (parsed.metadata) {
          metadata = parsed.metadata;
        }
        
        console.log(`[parseGeneratedCode] Parsed ${files.length} files from JSON`);
        return { files, dependencies, metadata };
      }
    }
  } catch (e) {
    console.log('[parseGeneratedCode] JSON parsing failed, trying legacy format:', e);
  }
  
  // FORMAT 2: Legacy // FILE: path (fallback)
  const fileRegex = /\/\/\s*FILE:\s*(.+?)(?:\n|$)/g;
  const matches = [...cleanedCode.matchAll(fileRegex)];
  
  if (matches.length > 0) {
    console.log(`[parseGeneratedCode] Found ${matches.length} files with // FILE: format`);
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      let filePath = match[1].trim();
      const startIndex = match.index! + match[0].length;
      
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
      let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
      
      const codeBlockMatch = rawContent.match(/^```[\w]*\n([\s\S]*?)```$/);
      if (codeBlockMatch) {
        rawContent = codeBlockMatch[1].trim();
      } else {
        rawContent = cleanFileContent(rawContent);
      }
      
      // Normaliser le chemin
      if (!filePath.startsWith('/')) {
        filePath = '/' + filePath;
      }
      const extension = filePath.split('.').pop() || '';
      
      files.push({
        path: filePath,
        content: rawContent,
        type: getFileType(extension)
      });
    }
  }
  
  console.log(`[parseGeneratedCode] Parsed ${files.length} files total:`);
  for (const file of files) {
    console.log(`  - ${file.path}: ${file.content.length} chars`);
  }
  
  return { files, dependencies, metadata };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log(`[generate-site] User ${user.id} generating React site for session ${sessionId}`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    // 🆕 NOUVEAU PROMPT SYSTÈME POUR REACT + SANDPACK
    const systemPrompt = `Tu es un expert en développement React. Tu génères des sites web React modernes et professionnels.

Le code doit fonctionner directement dans Sandpack (template "react") et être déployable sur Cloudflare Pages.

<stack>
- React 18+ avec le template Sandpack "react"
- Tailwind CSS (via CDN pour preview, compilé pour production)
- lucide-react pour les icônes (import { Icon } from 'lucide-react')
- Hooks React natifs (useState, useEffect, useRef, useCallback)
</stack>

<regles_strictes>
1. TOUJOURS générer du code COMPLET sans "// TODO" ou "// à compléter"
2. TOUJOURS exporter un composant par défaut nommé App dans /App.js
3. Utiliser les imports: import React, { useState } from 'react'
4. NE PAS utiliser de fetch/API externe sauf si demandé
5. NE PAS utiliser de dynamic imports (lazy loading)
6. Images placeholder: https://images.unsplash.com/photo-ID?w=WIDTH&h=HEIGHT&fit=crop
7. NE PAS utiliser d'émojis - uniquement des icônes lucide-react
</regles_strictes>

<format_sortie>
TOUJOURS répondre en JSON avec cette structure exacte:
{
  "files": {
    "/App.js": "// composant principal avec export default App",
    "/components/Header.js": "// si nécessaire",
    "/components/Footer.js": "// si nécessaire",
    "/styles.css": "// styles additionnels si nécessaire"
  },
  "dependencies": {
    "lucide-react": "^0.294.0"
  },
  "metadata": {
    "title": "Nom du projet",
    "description": "Description courte"
  }
}
</format_sortie>

<contraintes_sandpack>
- Structure de fichiers plate (pas de /src/)
- Extension .js (pas .jsx ni .tsx) pour le template react
- Le fichier principal DOIT être /App.js avec export default App
- Tailwind via CDN: inclus automatiquement par Sandpack
- Chaque composant doit avoir un export default
</contraintes_sandpack>

<contraintes_cloudflare>
- Code statique uniquement (pas de server-side)
- ESM modules exclusivement
- Build output: dist/
- SPA routing géré par _redirects
</contraintes_cloudflare>

<style_code>
- Composants fonctionnels avec hooks
- Noms de variables explicites en anglais
- HTML sémantique (main, header, nav, section, article, footer)
- Attributs ARIA pour l'accessibilité
- Classes Tailwind pour tous les styles
- Couleur principale: #03A5C0 (utiliser bg-[#03A5C0], text-[#03A5C0], etc.)
</style_code>

<structure_app_js>
Le fichier /App.js DOIT suivre ce modèle:

import React, { useState } from 'react';
import { Menu, X, Mail, Phone, MapPin } from 'lucide-react';
import './styles.css';

// Composants inline ou importés
function Header() {
  // ...
}

function Hero() {
  // ...
}

function Services() {
  // ...
}

function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('${SUPABASE_URL}/rest/v1/project_contacts', {
        method: 'POST',
        headers: {
          'apikey': '${SUPABASE_ANON_KEY}',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          project_id: '${sessionId}',
          name: formData.name,
          email: formData.email,
          message: formData.message
        })
      });
      if (response.ok) {
        alert('Message envoyé !');
        setFormData({ name: '', email: '', message: '' });
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };
  
  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Contact</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Champs du formulaire */}
        </form>
      </div>
    </section>
  );
}

function Footer() {
  // ...
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
</structure_app_js>

<images_unsplash>
Utilise ces images Unsplash de haute qualité:
- Hero/Bureau: https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop
- Équipe: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop
- Hôtel: https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop
- Nature: https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop
- Tech: https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop
- Immobilier: https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop
- Spa/Bien-être: https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop
</images_unsplash>

<planning>
AVANT de générer, réfléchis à:
1. Structure des composants nécessaires (Header, Hero, Services, About, Contact, Footer)
2. État et props requis
3. Responsive design (mobile-first avec Tailwind)
4. Accessibilité (aria-labels, sémantique HTML)
5. Formulaire de contact fonctionnel qui envoie à Supabase
</planning>

IMPORTANT: Génère maintenant un site React COMPLET, PROFESSIONNEL et FONCTIONNEL en format JSON, adapté au prompt de l'utilisateur.`;

    // Appel Claude API avec streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
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
      console.error('[generate-site] Claude API error:', response.status, errorText);
      
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        429: 'Rate limit exceeded. Please try again in a few moments.',
        500: 'An unexpected error occurred. Please try again later.'
      };
      
      return new Response(
        JSON.stringify({ error: statusMessages[response.status] || 'Request failed. Please try again later.' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let streamClosed = false;

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
            try { reader.cancel(); } catch (e) {}
            try { controller.close(); } catch (e) {}
          }
        };

        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          data: { sessionId, phase: 'analyzing' }
        })}\n\n`));

        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'generation_event',
          data: { type: 'analyze', message: 'Analyse de votre demande', status: 'in-progress', phase: 'analyzing' }
        })}\n\n`));

        const decoder = new TextDecoder();
        let accumulated = '';
        let lastParsedFiles: ProjectFile[] = [];
        let parsedDependencies: Record<string, string> = {};
        let parsedMetadata: any = {};
        let timeout: number | null = null;
        let inputTokens = 0;
        let outputTokens = 0;

        timeout = setTimeout(() => {
          console.error('[generate-site] Timeout après 120s');
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: 'Timeout - la génération a pris trop de temps' }
          })}\n\n`));
          closeStream();
        }, 120000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const event = JSON.parse(jsonStr);
                
                // Comptage des tokens
                if (event.type === 'message_start' && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens || 0;
                }
                if (event.type === 'message_delta' && event.usage) {
                  outputTokens = event.usage.output_tokens || 0;
                }

                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  const text = event.delta.text || '';
                  accumulated += text;

                  // Envoyer le stream au client
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'stream',
                    data: { text, phase: 'generating' }
                  })}\n\n`));
                  
                  // Parser progressivement
                  const parsed = parseGeneratedCode(accumulated);
                  if (parsed.files.length > lastParsedFiles.length) {
                    lastParsedFiles = parsed.files;
                    parsedDependencies = parsed.dependencies;
                    parsedMetadata = parsed.metadata;
                    
                    // Envoyer les fichiers au client
                    const filesRecord: Record<string, string> = {};
                    parsed.files.forEach(f => {
                      filesRecord[f.path] = f.content;
                    });
                    
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'files',
                      data: { 
                        files: filesRecord, 
                        dependencies: parsedDependencies,
                        metadata: parsedMetadata,
                        phase: 'generating' 
                      }
                    })}\n\n`));
                  }
                }

                if (event.type === 'message_stop') {
                  console.log('[generate-site] Message complete');
                }
              } catch (e) {
                // Ignorer les erreurs de parsing JSON
              }
            }
          }

          // Parsing final
          const finalParsed = parseGeneratedCode(accumulated);
          lastParsedFiles = finalParsed.files;
          parsedDependencies = finalParsed.dependencies;
          parsedMetadata = finalParsed.metadata;

          console.log('[generate-site] Final files:', lastParsedFiles.map(f => f.path));

          // Sauvegarder en base
          if (sessionId && lastParsedFiles.length > 0) {
            const filesRecord: Record<string, string> = {};
            lastParsedFiles.forEach(f => {
              filesRecord[f.path] = f.content;
            });

            // Ajouter les dépendances aux métadonnées
            const fullMetadata = {
              ...parsedMetadata,
              dependencies: parsedDependencies
            };

            const { error: updateError } = await supabaseClient
              .from('build_sessions')
              .update({ 
                project_files: filesRecord,
                updated_at: new Date().toISOString(),
                title: parsedMetadata?.title || null
              })
              .eq('id', sessionId);

            if (updateError) {
              console.error('[generate-site] Error saving to DB:', updateError);
            } else {
              console.log('[generate-site] Files saved to DB');
            }
          }

          // Envoi final
          const finalFilesRecord: Record<string, string> = {};
          lastParsedFiles.forEach(f => {
            finalFilesRecord[f.path] = f.content;
          });

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'files',
            data: { 
              files: finalFilesRecord, 
              dependencies: parsedDependencies,
              metadata: parsedMetadata,
              phase: 'complete' 
            }
          })}\n\n`));

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'tokens',
            data: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
          })}\n\n`));

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: { 
              success: true, 
              fileCount: lastParsedFiles.length,
              dependencies: parsedDependencies,
              metadata: parsedMetadata
            }
          })}\n\n`));

        } catch (e) {
          console.error('[generate-site] Stream error:', e);
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: e instanceof Error ? e.message : 'Unknown error' }
          })}\n\n`));
        } finally {
          if (timeout) clearTimeout(timeout);
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
