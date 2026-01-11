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
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  cleaned = cleaned.replace(/^```\s*$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// Normalise les chemins de fichiers pour Sandpack static
function normalizePath(path: string): string {
  let normalized = path.trim();
  
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Pour les projets statiques, pas de /src/ nécessaire
  // On garde les fichiers à la racine
  return normalized;
}

// Parser pour extraire les fichiers - supporte plusieurs formats de sortie Claude
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  console.log('[parseGeneratedCode] Input length:', code.length);
  console.log('[parseGeneratedCode] First 300 chars:', code.substring(0, 300));
  
  let cleanedCode = code.trim();
  if (cleanedCode.startsWith('```')) {
    cleanedCode = cleanedCode.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
  }
  
  // Format 1: // FILE: path suivi du contenu (format préféré)
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
      
      filePath = normalizePath(filePath);
      const extension = filePath.split('.').pop() || '';
      
      files.push({
        path: filePath,
        content: rawContent,
        type: getFileType(extension)
      });
    }
  }
  
  // Format 2: --- FILE: path ---
  if (files.length === 0) {
    const altRegex = /---\s*FILE:\s*(.+?)\s*---/g;
    const altMatches = [...cleanedCode.matchAll(altRegex)];
    
    if (altMatches.length > 0) {
      console.log(`[parseGeneratedCode] Found ${altMatches.length} files with --- FILE: --- format`);
      
      for (let i = 0; i < altMatches.length; i++) {
        const match = altMatches[i];
        let filePath = match[1].trim();
        const startIndex = match.index! + match[0].length;
        
        const nextMatch = altMatches[i + 1];
        const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
        let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
        
        rawContent = cleanFileContent(rawContent);
        filePath = normalizePath(filePath);
        const extension = filePath.split('.').pop() || '';
        
        files.push({
          path: filePath,
          content: rawContent,
          type: getFileType(extension)
        });
      }
    }
  }
  
  console.log(`[parseGeneratedCode] Parsed ${files.length} files total:`);
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
    'json': 'json',
    'svg': 'image',
  };
  return typeMap[extension.toLowerCase()] || 'text';
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

    console.log(`[generate-site] User ${user.id} generating STATIC site for session ${sessionId}`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    // 🆕 PROMPT SYSTÈME POUR GÉNÉRATION HTML/CSS/JS STATIQUE AVEC ROUTER VANILLA
    const systemPrompt = `Tu es un expert en développement web STATIQUE. Tu génères des sites HTML/CSS/JS purs, SANS React, SANS frameworks.

🎯 OBJECTIF: Créer un site web moderne, professionnel, 100% statique avec un SYSTÈME DE ROUTING SPA en JavaScript vanilla.

📁 FICHIERS À GÉNÉRER OBLIGATOIREMENT (format STRICT):

// FILE: /index.html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Titre du site]</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Navigation fixe -->
  <nav id="main-nav">...</nav>
  
  <!-- Conteneur principal pour les pages -->
  <main id="app"></main>
  
  <!-- Footer -->
  <footer>...</footer>
  
  <!-- Scripts -->
  <script src="router.js"></script>
  <script src="pages.js"></script>
  <script src="app.js"></script>
</body>
</html>

// FILE: /styles.css
[CSS complet avec variables, responsive, animations - MINIMUM 200 lignes]

// FILE: /router.js
// Système de routing SPA vanilla JS
(function() {
  window.Router = {
    routes: {},
    currentPath: '/',
    
    init: function() {
      // Intercepter les clics sur les liens
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (link) {
          e.preventDefault();
          const path = link.getAttribute('href');
          this.navigate(path);
        }
      });
      
      // Gérer le bouton retour du navigateur
      window.addEventListener('popstate', () => {
        this.render(window.location.pathname);
      });
      
      // Notifier l'iframe parent de l'état de navigation
      this.notifyParent();
      
      // Render initial
      this.render(window.location.pathname);
    },
    
    register: function(path, renderFn) {
      this.routes[path] = renderFn;
    },
    
    navigate: function(path) {
      if (path === this.currentPath) return;
      window.history.pushState({}, '', path);
      this.render(path);
      this.notifyParent();
    },
    
    render: function(path) {
      this.currentPath = path;
      const app = document.getElementById('app');
      const renderFn = this.routes[path] || this.routes['/404'] || this.routes['/'];
      
      if (renderFn) {
        app.innerHTML = renderFn();
        // Scroll to top on navigation
        window.scrollTo(0, 0);
        // Réinitialiser les event listeners
        this.bindEvents();
      }
      
      // Mettre à jour la nav active
      document.querySelectorAll('#main-nav a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === path);
      });
    },
    
    bindEvents: function() {
      // Formulaire de contact
      const form = document.getElementById('contact-form');
      if (form) {
        form.addEventListener('submit', this.handleContactSubmit.bind(this));
      }
    },
    
    handleContactSubmit: async function(e) {
      e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = 'Envoi en cours...';
      btn.disabled = true;
      
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
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            message: data.message
          })
        });
        
        if (response.ok) {
          form.innerHTML = '<div class="success-message">Message envoyé avec succès !</div>';
        } else {
          throw new Error('Erreur serveur');
        }
      } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        alert('Erreur lors de l\\'envoi. Veuillez réessayer.');
      }
    },
    
    notifyParent: function() {
      // Communiquer avec la FakeUrlBar de Magellan
      window.parent.postMessage({
        type: 'spa-navigation',
        path: this.currentPath,
        canGoBack: window.history.length > 1,
        canGoForward: false
      }, '*');
    }
  };
})();

// FILE: /pages.js
// Contenu des pages - chaque fonction retourne le HTML de la page
[Toutes les fonctions qui retournent le HTML de chaque page]

// FILE: /app.js
// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
  Router.init();
});

🎨 RÈGLES DE DESIGN OBLIGATOIRES:

1. COULEURS (définies en CSS variables):
   --primary: #03A5C0;
   --primary-dark: #028a9e;
   --secondary: #1a1a2e;
   --text: #1f2937;
   --text-light: #6b7280;
   --background: #ffffff;
   --background-alt: #f9fafb;
   --shadow: 0 10px 40px rgba(0,0,0,0.1);

2. NAVIGATION: Header fixe avec liens qui utilisent href="/" format (interceptés par le router)

3. ANIMATIONS CSS: Transitions smooth, hover effects, fade-in au scroll

4. RESPONSIVE: Mobile-first avec media queries (@media min-width: 768px, 1024px)

⚠️ INTERDICTIONS ABSOLUES:
- ❌ JAMAIS de React, Vue, Angular ou autre framework
- ❌ JAMAIS d'emojis ou smileys dans le contenu
- ❌ JAMAIS de CDN externe sauf images Unsplash
- ✅ JavaScript vanilla UNIQUEMENT
- ✅ CSS pur (pas de Tailwind, Bootstrap)

📷 IMAGES (URLs Unsplash valides):
- Hero: https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&h=1080&fit=crop
- Hôtel: https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop
- Bureau: https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop
- Nature: https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop
- Tech: https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop
- Équipe: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop

🔧 EXEMPLE DE pages.js COMPLET:

// Page d'accueil
Router.register('/', function() {
  return \`
    <section class="hero">
      <div class="hero-content">
        <h1>Bienvenue sur notre site</h1>
        <p>Description du service</p>
        <a href="/contact" class="btn btn-primary">Nous contacter</a>
      </div>
    </section>
    
    <section class="services">
      <div class="container">
        <h2>Nos Services</h2>
        <div class="services-grid">
          <div class="service-card">
            <h3>Service 1</h3>
            <p>Description</p>
          </div>
        </div>
      </div>
    </section>
  \`;
});

// Page À propos
Router.register('/about', function() {
  return \`
    <section class="page-header">
      <h1>À propos</h1>
    </section>
    <section class="about-content">
      <div class="container">
        <p>Notre histoire...</p>
      </div>
    </section>
  \`;
});

// Page Contact avec formulaire
Router.register('/contact', function() {
  return \`
    <section class="page-header">
      <h1>Contact</h1>
    </section>
    <section class="contact-section">
      <div class="container">
        <form id="contact-form" class="contact-form">
          <div class="form-group">
            <input type="text" name="name" placeholder="Votre nom" required>
          </div>
          <div class="form-group">
            <input type="email" name="email" placeholder="Votre email" required>
          </div>
          <div class="form-group">
            <input type="tel" name="phone" placeholder="Téléphone (optionnel)">
          </div>
          <div class="form-group">
            <textarea name="message" placeholder="Votre message" rows="5" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Envoyer</button>
        </form>
      </div>
    </section>
  \`;
});

// Page 404
Router.register('/404', function() {
  return \`
    <section class="error-page">
      <h1>404</h1>
      <p>Page non trouvée</p>
      <a href="/" class="btn btn-primary">Retour à l'accueil</a>
    </section>
  \`;
});

FORMAT DE SORTIE STRICT:
// FILE: /chemin/fichier.ext
[contenu complet du fichier]

// FILE: /autre/fichier.ext
[contenu complet]

Génère maintenant un site web STATIQUE MAGNIFIQUE, PROFESSIONNEL et COMPLET avec routing SPA.`;

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
                    data: { type: 'complete', message: 'Analyse terminée', status: 'completed', phase: 'analyzing' }
                  })}\n\n`));

                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'generation_event',
                    data: { type: 'plan', message: 'Génération du code HTML/CSS/JS', status: 'in-progress', phase: 'generation' }
                  })}\n\n`));
                }
                
                if (parsed.type === 'message_delta' && parsed.usage) {
                  outputTokens = parsed.usage.output_tokens || 0;
                }
              } catch (e) {}
              
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

                const finalFiles = parseGeneratedCode(accumulated);
                console.log(`[generate-site] Parsed ${finalFiles.length} files`);
                
                // Validation: au moins index.html
                const hasIndex = finalFiles.some(f => f.path.includes('index.html'));
                
                if (!hasIndex) {
                  console.error("[generate-site] ERROR: Missing index.html");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Fichier index.html manquant' }
                  })}\n\n`));
                  closeStream();
                  return;
                }
                
                const totalTokens = inputTokens + outputTokens;
                console.log(`[generate-site] Tokens: Input=${inputTokens}, Output=${outputTokens}, Total=${totalTokens}`);

                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'generation_event',
                  data: { type: 'complete', message: 'Génération terminée', status: 'completed', phase: 'generation' }
                })}\n\n`));

                const filesRecord: Record<string, string> = {};
                for (const file of finalFiles) {
                  filesRecord[file.path] = file.content;
                }
                console.log(`[generate-site] Sending ${Object.keys(filesRecord).length} files`);

                if (sessionId) {
                  await supabaseClient
                    .from('build_sessions')
                    .update({
                      project_files: filesRecord,
                      project_type: 'static',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', sessionId);
                }

                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'files',
                  data: { files: filesRecord }
                })}\n\n`));

                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: {
                    files: filesRecord,
                    totalFiles: finalFiles.length,
                    projectType: 'static',
                    tokens: { input: inputTokens, output: outputTokens, total: totalTokens }
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

                if (accumulated.length % 500 < delta.length) {
                  const currentFiles = parseGeneratedCode(accumulated);

                  if (currentFiles.length > lastParsedFiles.length) {
                    const newFiles = currentFiles.slice(lastParsedFiles.length);

                    for (const file of newFiles) {
                      let message = '';
                      const fileName = file.path.split('/').pop()?.replace(/\.\w+$/, '');

                      if (file.path.includes('index.html')) {
                        message = 'Création de la page principale';
                      } else if (file.path.includes('styles.css')) {
                        message = 'Mise en place des styles CSS';
                      } else if (file.path.includes('router.js')) {
                        message = 'Système de navigation SPA';
                      } else if (file.path.includes('pages.js')) {
                        message = 'Création des pages';
                      } else if (file.path.includes('app.js')) {
                        message = 'Initialisation de l\'application';
                      } else {
                        message = `Création de ${fileName}`;
                      }

                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'file_detected',
                        data: { path: file.path, type: file.type }
                      })}\n\n`));

                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'generation_event',
                        data: { type: 'write', message: message, status: 'completed', phase: 'generation', file: file.path }
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
