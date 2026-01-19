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

// CSS de base puissant pour fallback
const BASE_CSS = `:root {
  --primary: #03A5C0;
  --primary-dark: #028a9e;
  --primary-light: rgba(3, 165, 192, 0.1);
  --secondary: #1a1a2e;
  --text: #1f2937;
  --text-light: #6b7280;
  --background: #ffffff;
  --background-alt: #f9fafb;
  --border: #e5e7eb;
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.1);
  --radius: 8px;
  --transition: all 0.3s ease;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background: var(--background);
  -webkit-font-smoothing: antialiased;
}

img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; transition: color 0.2s; }
button { cursor: pointer; font-family: inherit; border: none; background: none; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.section { padding: 5rem 0; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius);
  font-weight: 500;
  transition: var(--transition);
}

.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

input, textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: var(--transition);
}
input:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 0.6s ease forwards; }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
.animate-slide-in { animation: slideIn 0.5s ease forwards; }
`;

// JS de base pour fallback
const BASE_JS = `document.addEventListener('DOMContentLoaded', function() {
  console.log('Site loaded successfully');
  
  // Mobile menu toggle
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
    });
  }
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  
  // Intersection Observer for animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
});
`;

// Extraire CSS et JS inline d'un HTML
function extractInlineAssets(htmlContent: string): { html: string; css: string; js: string } {
  let css = '';
  let js = '';
  let cleanedHtml = htmlContent;
  
  // Extraire toutes les balises <style>
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  cleanedHtml = cleanedHtml.replace(styleRegex, (match, content) => {
    css += content.trim() + '\n\n';
    return '';
  });
  
  // Extraire les <script> sans src (inline scripts seulement)
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  cleanedHtml = cleanedHtml.replace(scriptRegex, (match, content) => {
    const trimmed = content.trim();
    // Ignorer les configs Tailwind et les scripts vides
    if (trimmed && !trimmed.includes('tailwind.config')) {
      js += trimmed + '\n\n';
    }
    return '';
  });
  
  // S'assurer que le HTML a les liens externes
  if (!cleanedHtml.includes('href="styles.css"') && !cleanedHtml.includes("href='/styles.css'")) {
    cleanedHtml = cleanedHtml.replace('</head>', '  <link rel="stylesheet" href="styles.css">\n</head>');
  }
  if (!cleanedHtml.includes('src="app.js"') && !cleanedHtml.includes("src='/app.js'")) {
    cleanedHtml = cleanedHtml.replace('</body>', '  <script src="app.js"></script>\n</body>');
  }
  
  return { html: cleanedHtml.trim(), css: css.trim(), js: js.trim() };
}

// S'assurer que les 3 fichiers requis existent
function ensureRequiredFiles(files: ProjectFile[]): ProjectFile[] {
  const hasHtml = files.some(f => f.path === '/index.html');
  const hasCss = files.some(f => f.path === '/styles.css');
  const hasJs = files.some(f => f.path === '/app.js');
  
  // Si on a un seul HTML avec du contenu inline, extraire CSS/JS
  const htmlFile = files.find(f => f.path === '/index.html');
  if (htmlFile && files.length === 1) {
    console.log('[ensureRequiredFiles] Extracting inline assets from single HTML file');
    const extracted = extractInlineAssets(htmlFile.content);
    
    // Mettre à jour le HTML
    htmlFile.content = extracted.html;
    
    // Ajouter CSS extrait ou fallback
    if (extracted.css) {
      files.push({ path: '/styles.css', content: extracted.css, type: 'stylesheet' });
    } else if (!hasCss) {
      files.push({ path: '/styles.css', content: BASE_CSS, type: 'stylesheet' });
    }
    
    // Ajouter JS extrait ou fallback
    if (extracted.js) {
      files.push({ path: '/app.js', content: extracted.js, type: 'javascript' });
    } else if (!hasJs) {
      files.push({ path: '/app.js', content: BASE_JS, type: 'javascript' });
    }
    
    return files;
  }
  
  // Fallbacks pour fichiers manquants
  if (!hasHtml) {
    console.log('[ensureRequiredFiles] Adding minimal fallback index.html');
    files.push({
      path: '/index.html',
      content: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Génération en cours</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
  <style>body{margin:0;background:transparent;}</style>
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>`,
      type: 'html'
    });
  }
  
  if (!hasCss) {
    console.log('[ensureRequiredFiles] Adding fallback styles.css');
    files.push({ path: '/styles.css', content: BASE_CSS, type: 'stylesheet' });
  }
  
  if (!hasJs) {
    console.log('[ensureRequiredFiles] Adding fallback app.js');
    files.push({ path: '/app.js', content: BASE_JS, type: 'javascript' });
  }
  
  return files;
}

// Parser pour extraire les fichiers du format // FILE: path
function parseGeneratedCode(code: string): { files: ProjectFile[] } {
  let files: ProjectFile[] = [];
  
  console.log('[parseGeneratedCode] Input length:', code.length);
  
  let cleanedCode = code.trim();
  
  // Nettoyer les marqueurs markdown globaux
  if (cleanedCode.startsWith('```')) {
    cleanedCode = cleanedCode.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
  }
  
  // Parser le format // FILE: path
  const fileRegex = /\/\/\s*FILE:\s*([^\n]+)/g;
  const matches = [...cleanedCode.matchAll(fileRegex)];
  
  if (matches.length > 0) {
    console.log(`[parseGeneratedCode] Found ${matches.length} FILE markers`);
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      let filePath = match[1].trim();
      const startIndex = match.index! + match[0].length;
      
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
      let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
      
      // Nettoyer les blocs de code markdown
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
      
      // Vérification: le chemin doit avoir une extension valide
      if (extension && ['html', 'css', 'js', 'svg', 'json'].includes(extension)) {
        files.push({
          path: filePath,
          content: rawContent,
          type: getFileType(extension)
        });
        console.log(`  ✓ Parsed: ${filePath} (${rawContent.length} chars)`);
      }
    }
  }
  
  // Si aucun fichier trouvé avec // FILE:, chercher du HTML brut
  if (files.length === 0 && cleanedCode.includes('<!DOCTYPE html>')) {
    console.log('[parseGeneratedCode] No FILE markers found, extracting raw HTML');
    files.push({
      path: '/index.html',
      content: cleanedCode,
      type: 'html'
    });
  }
  
  // Appliquer les fallbacks pour garantir les 3 fichiers
  files = ensureRequiredFiles(files);
  
  console.log(`[parseGeneratedCode] Final files (${files.length}):`);
  for (const file of files) {
    console.log(`  - ${file.path}: ${file.content.length} chars`);
  }
  
  return { files };
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

    // 🆕 PROMPT SYSTÈME CRÉATIF - CONTENU DANS LE HTML
    const systemPrompt = `Tu es un expert en développement web vanilla. Tu génères des sites vitrines statiques COMPLETS avec TOUT le contenu directement dans le HTML.

<OBJECTIF>

Créer un site vitrine ONE-PAGE complet et professionnel avec TOUTES les sections visibles dans le HTML :
- Header/Navigation fixe
- Section Hero avec titre accrocheur et CTA
- Section À propos / Présentation
- Section Services (minimum 3 services avec icônes)
- Section Portfolio/Réalisations OU Témoignages
- Section Contact avec formulaire fonctionnel
- Footer complet

Tu es LIBRE sur le design, les couleurs, la mise en page, le thème - sois créatif et moderne.

</OBJECTIF>

<FORMAT_OBLIGATOIRE>

Génère EXACTEMENT 3 fichiers séparés, chacun précédé de son marqueur :

// FILE: index.html

[HTML COMPLET avec TOUT le contenu visible - hero, services, about, contact, etc.]

// FILE: styles.css

[CSS complet - minimum 300 lignes avec animations, responsive, etc.]

// FILE: app.js

[JavaScript pour interactions : menu mobile, scroll smooth, formulaire, animations]

</FORMAT_OBLIGATOIRE>

<RÈGLES_STRICTES>

1. UNIQUEMENT HTML5, CSS3 et JavaScript ES6+ vanilla - AUCUN framework

2. JAMAIS de JSX ou syntaxe React

3. JAMAIS de <style> dans le HTML - tout le CSS va dans styles.css

4. JAMAIS de <script> inline dans le HTML - tout le JS va dans app.js

5. Navigation avec ancres href="#section" (ex: href="#services", href="#contact")

6. TOUT LE CONTENU DOIT ÊTRE VISIBLE DANS LE HTML - pas d'injection JavaScript

7. Code COMPLET et FONCTIONNEL - pas de TODO ou commentaires "à compléter"

8. Images : URLs Unsplash pertinentes (format: https://images.unsplash.com/photo-XXXXX?auto=format&fit=crop&w=XXX&q=80)

9. Icônes : SVG inline uniquement

</RÈGLES_STRICTES>

<ARCHITECTURE>

Le site est une ONE-PAGE avec scroll fluide entre sections :

index.html contient :
- <header> avec navigation fixe et liens ancres (#hero, #services, #about, #contact)
- <section id="hero"> : hero avec titre, sous-titre, boutons CTA
- <section id="services"> : grille de services (minimum 3)
- <section id="about"> : présentation entreprise avec image
- <section id="portfolio"> ou <section id="testimonials"> : réalisations ou avis clients
- <section id="contact"> : formulaire (nom, email, message) avec validation
- <footer> : liens, contact, réseaux sociaux

Les liens CSS/JS :
- <link rel="stylesheet" href="styles.css"> dans le head
- <script src="app.js"></script> avant </body>

</ARCHITECTURE>

<STRUCTURE_APP_JS>

// Menu mobile toggle
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('navMenu');
if (mobileToggle && navMenu) {
  mobileToggle.addEventListener('click', () => navMenu.classList.toggle('active'));
}

// Smooth scroll pour liens ancres
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    if (navMenu) navMenu.classList.remove('active');
  });
});

// Navbar effet au scroll
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Formulaire contact
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Simuler envoi
    const btn = contactForm.querySelector('button[type="submit"]');
    btn.textContent = 'Envoyé ✓';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Envoyer'; btn.disabled = false; contactForm.reset(); }, 3000);
  });
}

// Animations au scroll (IntersectionObserver)
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

</STRUCTURE_APP_JS>

<LIBERTÉ_CRÉATIVE>

Tu es TOTALEMENT LIBRE de choisir :

- Le thème du site (tech, restaurant, agence, portfolio, immobilier, etc.)
- Les couleurs (palette harmonieuse de ton choix)
- La typographie (modernes et lisibles)
- Le layout (grids, flexbox, asymétrique, etc.)
- Les animations (subtiles et professionnelles)
- Le style général (minimaliste, coloré, sombre, glassmorphism, etc.)
- Les images Unsplash pertinentes pour ton thème
- Les icônes SVG personnalisées

CRÉE un design moderne, cohérent et professionnel qui se démarque.

</LIBERTÉ_CRÉATIVE>

<INSTRUCTIONS_FINALES>

1. Génère 3 fichiers complets et fonctionnels (index.html, styles.css, app.js)
2. TOUT LE CONTENU visible dans le HTML - hero, services, about, contact, footer
3. Design responsive (mobile-first)
4. Scroll fluide entre sections
5. Contenu réaliste et cohérent avec le thème choisi
6. Formulaire de contact avec validation visuelle
7. Code propre et bien organisé
8. Animations subtiles avec IntersectionObserver
9. Minimum 300 lignes de CSS
10. Images Unsplash pertinentes

RAPPEL : 
- Uniquement HTML/CSS/JS vanilla - pas de React, JSX ou framework !
- TOUT le contenu est DANS le HTML, pas injecté par JavaScript !

</INSTRUCTIONS_FINALES>`

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
        max_tokens: 16000,
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
      
      return new Response(
        JSON.stringify({ error: 'Generation failed. Please try again.' }),
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

        // Générer le nom du projet en parallèle
        let projectName: string | null = null;
        const generateProjectName = async () => {
          try {
            console.log('[generate-site] Generating project name...');
            const nameResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-3-5-haiku-latest',
                max_tokens: 50,
                messages: [{ 
                  role: 'user', 
                  content: `Génère un nom de projet court (2-4 mots max, format slug avec tirets). Pas de guillemets, pas de ponctuation.
Exemples: mon-cabinet-avocat, sportcoach-app, luxestate-immo
Pour: "${prompt.substring(0, 200)}"`
                }],
              }),
            });
            
            if (nameResponse.ok) {
              const data = await nameResponse.json();
              const rawName = data.content[0]?.text?.trim() || '';
              // Nettoyer et formater en slug
              projectName = rawName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 30);
              
              console.log('[generate-site] Generated project name:', projectName);
              
              // Sauvegarder immédiatement dans la DB
              if (sessionId && projectName) {
                await supabaseClient
                  .from('build_sessions')
                  .update({ title: projectName })
                  .eq('id', sessionId);
                
                // Envoyer au frontend
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'project_name',
                  data: { name: projectName }
                })}\n\n`));
              }
            }
          } catch (e) {
            console.error('[generate-site] Error generating project name:', e);
          }
        };
        
        // Lancer la génération du nom en parallèle (non-bloquant)
        generateProjectName();

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
          console.error('[generate-site] Timeout après 180s');
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: 'Timeout - la génération a pris trop de temps' }
          })}\n\n`));
          closeStream();
        }, 180000);

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
                    
                    // Envoyer les fichiers au client
                    const filesRecord: Record<string, string> = {};
                    parsed.files.forEach(f => {
                      filesRecord[f.path] = f.content;
                    });
                    
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'files',
                      data: { 
                        files: filesRecord, 
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

          console.log('[generate-site] Final files:', lastParsedFiles.map(f => f.path));

          // Sauvegarder en base
          if (sessionId && lastParsedFiles.length > 0) {
            const filesRecord: Record<string, string> = {};
            lastParsedFiles.forEach(f => {
              filesRecord[f.path] = f.content;
            });

            const { error: updateError } = await supabaseClient
              .from('build_sessions')
              .update({ 
                project_files: filesRecord,
                project_type: 'website',
                updated_at: new Date().toISOString()
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
              fileCount: lastParsedFiles.length
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
