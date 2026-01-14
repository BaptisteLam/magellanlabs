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
    console.log('[ensureRequiredFiles] Adding fallback index.html');
    files.push({
      path: '/index.html',
      content: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site en construction</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="min-h-screen bg-gray-50">
  <div id="app" class="flex items-center justify-center min-h-screen">
    <div class="text-center p-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-4">Site en construction</h1>
      <p class="text-gray-600">Le contenu arrive bientôt...</p>
    </div>
  </div>
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

    // 🆕 PROMPT SYSTÈME RENFORCÉ - GÉNÉRATION OBLIGATOIRE DE 3 FICHIERS SÉPARÉS
    const systemPrompt = `Tu es un expert en développement web vanilla. Tu génères des sites web statiques professionnels en HTML/CSS/JavaScript pur.

<RÈGLE_CRITIQUE>
TU DOIS OBLIGATOIREMENT générer EXACTEMENT 3 fichiers SÉPARÉS avec le format ci-dessous.
JAMAIS de CSS inline dans <style>, JAMAIS de JS inline dans <script>.
Chaque fichier DOIT être précédé de son marqueur // FILE: sur une ligne séparée.
</RÈGLE_CRITIQUE>

<FORMAT_OBLIGATOIRE>
// FILE: /index.html
[contenu HTML complet]

// FILE: /styles.css
[contenu CSS complet - minimum 200 lignes]

// FILE: /app.js
[contenu JavaScript complet]
</FORMAT_OBLIGATOIRE>

<STACK>
- HTML5 sémantique
- CSS3 moderne avec variables CSS, Flexbox/Grid, animations
- JavaScript ES6+ vanilla (PAS de framework, PAS de React, PAS de JSX)
- Tailwind CSS via CDN dans index.html
</STACK>

<RÈGLES_STRICTES>
1. UNIQUEMENT du HTML, CSS et JavaScript vanilla - AUCUN FRAMEWORK
2. JAMAIS de JSX, JAMAIS de syntaxe React (useState, useEffect, props, etc.)
3. JAMAIS de balises <style> dans le HTML - tout le CSS va dans /styles.css
4. JAMAIS de <script> inline dans le HTML (sauf config Tailwind) - tout le JS va dans /app.js
5. Le HTML doit inclure: <link rel="stylesheet" href="styles.css"> et <script src="app.js"></script>
6. Générer du code COMPLET sans "// TODO" ou "// à compléter"
7. NE PAS utiliser d'émojis - uniquement des icônes SVG inline
8. Images: utiliser des URLs Unsplash valides
</RÈGLES_STRICTES>

<STRUCTURE_INDEX_HTML>
Le fichier /index.html DOIT suivre ce modèle EXACT:

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Titre du site]</title>
  <meta name="description" content="[Description SEO]">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#03A5C0',
            'primary-dark': '#028a9e',
          }
        }
      }
    }
  </script>
</head>
<body class="min-h-screen bg-white">
  <!-- Navigation -->
  <nav id="main-nav" class="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-sm z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <a href="#" class="text-xl font-bold text-gray-900">[Logo/Nom]</a>
        <button id="mobile-menu-btn" class="md:hidden p-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <ul id="desktop-menu" class="hidden md:flex space-x-8">
          <li><a href="#accueil" class="nav-link">Accueil</a></li>
          <li><a href="#services" class="nav-link">Services</a></li>
          <li><a href="#about" class="nav-link">À propos</a></li>
          <li><a href="#contact" class="nav-link">Contact</a></li>
        </ul>
      </div>
      <!-- Mobile menu -->
      <ul id="mobile-menu" class="hidden md:hidden pb-4 space-y-2">
        <li><a href="#accueil" class="block py-2 text-gray-600">Accueil</a></li>
        <li><a href="#services" class="block py-2 text-gray-600">Services</a></li>
        <li><a href="#about" class="block py-2 text-gray-600">À propos</a></li>
        <li><a href="#contact" class="block py-2 text-gray-600">Contact</a></li>
      </ul>
    </div>
  </nav>

  <main id="app" class="pt-16">
    <!-- Hero Section -->
    <section id="accueil" class="hero-section">
      <!-- Contenu du hero -->
    </section>
    
    <!-- Services Section -->
    <section id="services" class="section bg-gray-50">
      <!-- Contenu des services -->
    </section>
    
    <!-- About Section -->
    <section id="about" class="section">
      <!-- Contenu à propos -->
    </section>
    
    <!-- Contact Section -->
    <section id="contact" class="section bg-gray-50">
      <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-3xl font-bold text-center mb-4">Contactez-nous</h2>
        <p class="text-gray-600 text-center mb-12">Nous sommes là pour vous aider</p>
        <form id="contact-form" class="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 mb-2">Nom</label>
              <input type="text" id="name" name="name" required class="form-input" placeholder="Votre nom">
            </div>
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" id="email" name="email" required class="form-input" placeholder="votre@email.com">
            </div>
          </div>
          <div>
            <label for="message" class="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea id="message" name="message" rows="5" required class="form-input resize-none" placeholder="Votre message..."></textarea>
          </div>
          <button type="submit" class="btn-primary w-full">Envoyer le message</button>
        </form>
      </div>
    </section>
  </main>

  <footer class="bg-gray-900 text-white py-12">
    <div class="max-w-7xl mx-auto px-4 text-center">
      <p class="text-gray-400">© 2024 [Nom]. Tous droits réservés.</p>
    </div>
  </footer>

  <script src="app.js"></script>
</body>
</html>
</STRUCTURE_INDEX_HTML>

<STRUCTURE_STYLES_CSS>
Le fichier /styles.css DOIT contenir AU MINIMUM 200 lignes de CSS:

/* Variables CSS */
:root {
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
  --radius: 0.5rem;
  --radius-lg: 1rem;
  --transition: all 0.3s ease;
}

/* Reset */
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: var(--text);
}

/* Navigation */
.nav-link {
  color: var(--text-light);
  transition: var(--transition);
  position: relative;
}
.nav-link:hover {
  color: var(--primary);
}
.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary);
  transition: width 0.3s ease;
}
.nav-link:hover::after {
  width: 100%;
}

/* Sections */
.section {
  padding: 5rem 0;
}

.hero-section {
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
}

/* Boutons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2rem;
  background: var(--primary);
  color: white;
  font-weight: 500;
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  transition: var(--transition);
}
.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2rem;
  background: transparent;
  color: var(--primary);
  font-weight: 500;
  border-radius: var(--radius);
  border: 2px solid var(--primary);
  cursor: pointer;
  transition: var(--transition);
}
.btn-secondary:hover {
  background: var(--primary-light);
}

/* Formulaires */
.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: var(--transition);
  background: white;
}
.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* Cards */
.card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}
.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease forwards;
}

.animate-fade-in {
  animation: fadeIn 0.6s ease forwards;
}

.animate-slide-in {
  animation: slideInLeft 0.6s ease forwards;
}

/* Delays pour animations en cascade */
.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }

/* Toast notifications */
.toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 1rem 1.5rem;
  border-radius: var(--radius);
  font-weight: 500;
  z-index: 1000;
  animation: fadeInUp 0.3s ease;
}
.toast-success {
  background: #10b981;
  color: white;
}
.toast-error {
  background: #ef4444;
  color: white;
}

/* Responsive */
@media (max-width: 768px) {
  .section {
    padding: 3rem 0;
  }
  .hero-section {
    min-height: auto;
    padding: 6rem 0 4rem;
  }
}
</STRUCTURE_STYLES_CSS>

<STRUCTURE_APP_JS>
Le fichier /app.js DOIT contenir JavaScript vanilla fonctionnel:

document.addEventListener('DOMContentLoaded', function() {
  console.log('Site initialized');
  
  // ========== Mobile Menu Toggle ==========
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
      // Animer l'icône
      const icon = menuBtn.querySelector('svg');
      if (icon) {
        icon.classList.toggle('rotate-90');
      }
    });
    
    // Fermer le menu au clic sur un lien
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }
  
  // ========== Smooth Scroll ==========
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        const navHeight = document.getElementById('main-nav')?.offsetHeight || 0;
        const targetPosition = target.offsetTop - navHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // ========== Navbar scroll effect ==========
  const nav = document.getElementById('main-nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        nav.classList.add('shadow-md');
        nav.style.background = 'rgba(255, 255, 255, 0.98)';
      } else {
        nav.classList.remove('shadow-md');
        nav.style.background = 'rgba(255, 255, 255, 0.95)';
      }
    });
  }
  
  // ========== Intersection Observer for animations ==========
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in-up');
        entry.target.style.opacity = '1';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
  
  // ========== Contact Form ==========
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Envoi en cours...';
      submitBtn.disabled = true;
      
      // Simuler l'envoi (remplacer par vraie API si nécessaire)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showToast('Message envoyé avec succès !', 'success');
      this.reset();
      
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    });
  }
  
  // ========== Toast Notification ==========
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  // Exposer globalement si besoin
  window.showToast = showToast;
});
</STRUCTURE_APP_JS>

<IMAGES_UNSPLASH>
Utilise ces images Unsplash de haute qualité:
- Hero/Bureau: https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop
- Équipe: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop
- Tech: https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop
- Nature: https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop
- Immobilier: https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop
- Portrait pro: https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop
</IMAGES_UNSPLASH>

<ICONES_SVG>
Pour les icônes, utilise UNIQUEMENT des SVG inline:

<!-- Check -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
</svg>

<!-- Arrow right -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
</svg>

<!-- Phone -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
</svg>

<!-- Email -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
</svg>

<!-- Location -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
</svg>
</ICONES_SVG>

RAPPEL FINAL: Tu DOIS générer EXACTEMENT 3 fichiers séparés avec les marqueurs // FILE: sur des lignes distinctes. Le HTML ne doit PAS contenir de <style> ni de <script> inline (sauf config Tailwind). Tout le CSS va dans /styles.css, tout le JS va dans /app.js.`

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
