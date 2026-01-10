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

// Nettoie le contenu d'un fichier des marqueurs markdown résiduels
function cleanFileContent(content: string): string {
  let cleaned = content.trim();
  
  // Supprimer les code blocks au début (```tsx, ```html, ```css, ```json, etc.)
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/gm, '');
  
  // Supprimer les code blocks à la fin (```)
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Supprimer les marqueurs résiduels au milieu du contenu
  cleaned = cleaned.replace(/^```\s*$/gm, '');
  
  // Nettoyer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

// Normalise les chemins de fichiers pour Sandpack
function normalizePath(path: string): string {
  let normalized = path.trim();
  
  // Ajouter / au début si absent
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Ne pas modifier les fichiers de config à la racine
  const rootFiles = ['/package.json', '/vite.config.ts', '/tsconfig.json', '/tsconfig.node.json', '/index.html'];
  if (rootFiles.includes(normalized)) {
    return normalized;
  }
  
  // Ajouter /src/ si c'est un fichier source sans préfixe src
  if (!normalized.startsWith('/src/') && (
    normalized.endsWith('.tsx') || 
    normalized.endsWith('.ts') || 
    normalized.endsWith('.jsx') || 
    normalized.endsWith('.js') ||
    normalized.endsWith('.css')
  )) {
    // Si le chemin commence par /components/, /hooks/, etc., ajouter /src devant
    if (normalized.match(/^\/(components|hooks|utils|lib|services|pages|styles)\//)) {
      normalized = '/src' + normalized;
    } else if (!normalized.includes('/')) {
      // Fichier à la racine comme /App.tsx -> /src/App.tsx
      normalized = '/src' + normalized;
    }
  }
  
  return normalized;
}

// Parser pour extraire les fichiers au format // FILE: path
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Format 1: // FILE: path suivi du contenu (avec ou sans code blocks)
  const fileRegex = /\/\/\s*FILE:\s*(.+?)(?:\n|$)/g;
  const matches = [...code.matchAll(fileRegex)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    let filePath = match[1].trim();
    const startIndex = match.index! + match[0].length;
    
    // Trouve le contenu jusqu'au prochain fichier
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : code.length;
    let rawContent = code.slice(startIndex, endIndex).trim();
    
    // Nettoyer les code blocks markdown si présents (format ```xxx ... ```)
    const codeBlockMatch = rawContent.match(/^```[\w]*\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      rawContent = codeBlockMatch[1].trim();
    } else {
      // Appliquer le nettoyage général pour les marqueurs résiduels
      rawContent = cleanFileContent(rawContent);
    }
    
    // Normaliser le chemin
    filePath = normalizePath(filePath);
    
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
      const normalizedPath = normalizePath(path.trim());
      const extension = normalizedPath.split('.').pop() || '';
      
      files.push({
        path: normalizedPath,
        content: cleanFileContent(content),
        type: getFileType(extension)
      });
    }
  }
  
  // Log pour debug
  console.log(`[parseGeneratedCode] Parsed ${files.length} files`);
  for (const file of files) {
    console.log(`  - ${file.path}: ${file.content.length} chars`);
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

    // Variables Supabase pour le formulaire de contact
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    // PROMPT SYSTÈME OPTIMISÉ POUR SANDPACK
    // Sandpack gère automatiquement: package.json, vite.config, tsconfig, index.html
    // Claude doit générer UNIQUEMENT les fichiers src/
    const systemPrompt = `Tu es un expert React/TypeScript. Tu génères des projets React pour prévisualisation dans Sandpack.

🎯 IMPORTANT: Sandpack gère automatiquement la configuration (package.json, vite.config, tsconfig, index.html).
Tu dois générer UNIQUEMENT les fichiers sources dans src/.

📁 STRUCTURE OBLIGATOIRE À GÉNÉRER:

// FILE: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// FILE: src/App.tsx
[Composant principal avec sections complètes - 100+ lignes de JSX]
[Import et utilise TOUS les composants que tu crées]

// FILE: src/index.css
[Styles CSS modernes avec variables, animations, responsive - 80+ lignes]

// FILE: src/components/[NomComposant].tsx
[Chaque composant importé dans App.tsx DOIT avoir son fichier]

🔥 FORMULAIRE DE CONTACT OBLIGATOIRE:

// FILE: src/components/ContactForm.tsx
import { useState, FormEvent } from 'react'

export default function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')

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
          phone: formData.phone || null,
          message: formData.message
        })
      })

      if (response.ok) {
        setStatus('success')
        setMessage('Message envoyé avec succès!')
        setFormData({ name: '', email: '', phone: '', message: '' })
      } else {
        throw new Error('Erreur serveur')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Erreur lors de l\\'envoi. Réessayez.')
    }
  }

  return (
    <section className="contact-section">
      <h2>Contactez-nous</h2>
      <form onSubmit={handleSubmit} className="contact-form">
        <input type="text" placeholder="Votre nom" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        <input type="email" placeholder="Votre email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        <input type="tel" placeholder="Téléphone (optionnel)" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
        <textarea placeholder="Votre message" required value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
        <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Envoi...' : 'Envoyer'}</button>
      </form>
      {message && <div className={\`form-message \${status}\`}>{message}</div>}
    </section>
  )
}

⚠️ RÈGLES CRITIQUES:
1. CHAQUE composant importé dans App.tsx DOIT avoir son fichier correspondant généré
2. Les imports utilisent ./ ou ../ relatifs (pas de @/ car Sandpack ne le supporte pas nativement)
3. Tous les chemins commencent par src/
4. Design moderne: gradients, ombres, animations, responsive
5. TypeScript strict avec types appropriés
6. Utilise useState, useEffect pour l'interactivité

❌ NE PAS GÉNÉRER:
- package.json (Sandpack le gère)
- vite.config.ts (Sandpack le gère)
- tsconfig.json (Sandpack le gère)
- index.html (Sandpack le gère)

FORMAT DE SORTIE:
// FILE: src/chemin/fichier.tsx
[contenu du fichier]

// FILE: src/chemin/autre.tsx
[contenu]

Génère maintenant un projet React complet et professionnel.`;

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

    // Stream SSE avec parsing en temps réel
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
          data: { sessionId, phase: 'analyzing' }
        })}\n\n`));

        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'generation_event',
          data: {
            type: 'analyze',
            message: 'Analyse de votre demande',
            status: 'in-progress',
            phase: 'analyzing'
          }
        })}\n\n`));

        const decoder = new TextDecoder();
        let accumulated = '';
        let lastParsedFiles: ProjectFile[] = [];
        let timeout: number | null = null;
        
        let inputTokens = 0;
        let outputTokens = 0;

        timeout = setTimeout(() => {
          console.error('[generate-site] Timeout après 120s');
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: 'Timeout: La génération a pris trop de temps.' }
          })}\n\n`));
          closeStream();
        }, 120000);

        try {
          while (!streamClosed) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (streamClosed) break;
              
              if (!line.trim() || line.startsWith(':') || line === '') continue;
              
              if (line.startsWith('event:')) continue;
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              
              try {
                const parsed = JSON.parse(dataStr);
                
                if (parsed.type === 'message_start' && parsed.message?.usage) {
                  inputTokens = parsed.message.usage.input_tokens || 0;
                  console.log(`[generate-site] Input tokens: ${inputTokens}`);

                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'generation_event',
                    data: {
                      type: 'complete',
                      message: 'Analyse terminée',
                      status: 'completed',
                      phase: 'analyzing'
                    }
                  })}\n\n`));

                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'generation_event',
                    data: {
                      type: 'plan',
                      message: 'Génération du code React',
                      status: 'in-progress',
                      phase: 'generation'
                    }
                  })}\n\n`));
                }
                
                if (parsed.type === 'message_delta' && parsed.usage) {
                  outputTokens = parsed.usage.output_tokens || 0;
                }
              } catch (e) {
                // Ignore
              }
              
              // Claude envoie un [DONE] ou message_stop
              if (dataStr === '[DONE]' || dataStr.includes('"type":"message_stop"')) {
                if (timeout) clearTimeout(timeout);
                
                console.log(`[generate-site] Final content: ${accumulated.length} characters`);
                
                if (!accumulated || accumulated.trim().length === 0) {
                  console.error("[generate-site] ERROR: Empty content");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Contenu généré vide' }
                  })}\n\n`));
                  closeStream();
                  return;
                }

                // Parsing final
                const finalFiles = parseGeneratedCode(accumulated);
                
                console.log(`[generate-site] Parsed ${finalFiles.length} files`);
                
                // Validation: au moins App.tsx et main.tsx
                const hasApp = finalFiles.some(f => f.path.includes('App.tsx'));
                const hasMain = finalFiles.some(f => f.path.includes('main.tsx'));
                
                if (!hasApp && !hasMain) {
                  console.error("[generate-site] ERROR: Missing App.tsx or main.tsx");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Fichiers React essentiels manquants (App.tsx, main.tsx)' }
                  })}\n\n`));
                  closeStream();
                  return;
                }
                
                const totalTokens = inputTokens + outputTokens;
                console.log(`[generate-site] Tokens: Input=${inputTokens}, Output=${outputTokens}, Total=${totalTokens}`);

                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'generation_event',
                  data: {
                    type: 'complete',
                    message: 'Génération terminée',
                    status: 'completed',
                    phase: 'generation'
                  }
                })}\n\n`));

                // Convertir en Record<string, string>
                const filesRecord: Record<string, string> = {};
                for (const file of finalFiles) {
                  filesRecord[file.path] = file.content;
                }
                console.log(`[generate-site] Sending ${Object.keys(filesRecord).length} files`);

                // Sauvegarder dans Supabase
                if (sessionId) {
                  await supabaseClient
                    .from('build_sessions')
                    .update({
                      project_files: filesRecord,
                      project_type: 'react',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', sessionId);
                }

                // Event: files
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'files',
                  data: { files: filesRecord }
                })}\n\n`));

                // Event: complete
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: {
                    files: filesRecord,
                    totalFiles: finalFiles.length,
                    projectType: 'react',
                    tokens: {
                      input: inputTokens,
                      output: outputTokens,
                      total: totalTokens
                    }
                  }
                })}\n\n`));
                
                closeStream();
                return;
              }

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.delta?.text || json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;
                
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk',
                  data: { content: delta }
                })}\n\n`));

                // Parser tous les 500 caractères
                if (accumulated.length % 500 < delta.length) {
                  const currentFiles = parseGeneratedCode(accumulated);

                  if (currentFiles.length > lastParsedFiles.length) {
                    const newFiles = currentFiles.slice(lastParsedFiles.length);

                    for (const file of newFiles) {
                      let message = '';
                      const fileName = file.path.split('/').pop()?.replace('.tsx', '').replace('.ts', '').replace('.css', '');

                      if (file.path.includes('App.tsx')) {
                        message = 'Création du composant principal';
                      } else if (file.path.includes('main.tsx')) {
                        message = 'Point d\'entrée React';
                      } else if (file.path.includes('.css')) {
                        message = 'Mise en place des styles';
                      } else if (file.path.includes('components/')) {
                        message = `Composant ${fileName}`;
                      } else {
                        message = `Création de ${fileName}`;
                      }

                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'file_detected',
                        data: { path: file.path, type: file.type }
                      })}\n\n`));

                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'generation_event',
                        data: {
                          type: 'write',
                          message: message,
                          status: 'completed',
                          phase: 'generation',
                          file: file.path
                        }
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
          
          if (!streamClosed) {
            if (timeout) clearTimeout(timeout);
            closeStream();
          }
        } catch (error) {
          if (timeout) clearTimeout(timeout);
          console.error('[generate-site] Stream error:', error);
          
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
