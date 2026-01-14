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

⚠️ RÈGLE CRITIQUE - CODE COMPLET OBLIGATOIRE:
- Le CSS doit faire MINIMUM 300 lignes avec tous les styles pour chaque élément
- Le JavaScript doit être FONCTIONNEL et COMPLET
- Chaque page doit avoir du contenu HTML riche et détaillé
- NE JAMAIS utiliser de commentaires comme "..." ou "/* reste du code */" - TOUT le code doit être présent
- NE JAMAIS tronquer le code ou utiliser des ellipses

📁 STRUCTURE OBLIGATOIRE DES FICHIERS:

// FILE: /index.html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Titre du site]</title>
  <meta name="description" content="[Description SEO]">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav id="main-nav" class="navbar">
    <div class="nav-container">
      <a href="/" class="nav-logo">[Logo/Nom]</a>
      <button class="nav-toggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-menu">
        <li><a href="/" class="nav-link">Accueil</a></li>
        <li><a href="/services" class="nav-link">Services</a></li>
        <li><a href="/about" class="nav-link">À propos</a></li>
        <li><a href="/contact" class="nav-link">Contact</a></li>
      </ul>
    </div>
  </nav>
  
  <main id="app"></main>
  
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-grid">
        <div class="footer-col">
          <h4>À propos</h4>
          <p>[Description courte]</p>
        </div>
        <div class="footer-col">
          <h4>Liens rapides</h4>
          <ul>
            <li><a href="/">Accueil</a></li>
            <li><a href="/services">Services</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <p>Email: contact@example.com</p>
          <p>Tél: +33 1 23 45 67 89</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2025 [Nom]. Tous droits réservés.</p>
      </div>
    </div>
  </footer>
  
  <script src="router.js"></script>
  <script src="pages.js"></script>
  <script src="app.js"></script>
</body>
</html>

// FILE: /styles.css
/* === VARIABLES CSS === */
:root {
  --primary: #03A5C0;
  --primary-dark: #028a9e;
  --primary-light: rgba(3, 165, 192, 0.1);
  --secondary: #1a1a2e;
  --text: #1f2937;
  --text-light: #6b7280;
  --text-muted: #9ca3af;
  --background: #ffffff;
  --background-alt: #f9fafb;
  --background-dark: #111827;
  --border: #e5e7eb;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.1);
  --shadow-xl: 0 25px 50px -12px rgba(0,0,0,0.25);
  --radius: 8px;
  --radius-lg: 16px;
  --transition: all 0.3s ease;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* === RESET & BASE === */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  background: var(--background);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

a {
  text-decoration: none;
  color: inherit;
  transition: var(--transition);
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

ul, ol {
  list-style: none;
}

/* === UTILITAIRES === */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section {
  padding: 80px 0;
}

.section-alt {
  background: var(--background-alt);
}

.text-center {
  text-align: center;
}

.text-primary {
  color: var(--primary);
}

/* === TYPOGRAPHIE === */
h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.2;
  color: var(--secondary);
}

h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
h2 { font-size: clamp(2rem, 4vw, 3rem); margin-bottom: 1rem; }
h3 { font-size: clamp(1.5rem, 3vw, 2rem); }
h4 { font-size: 1.25rem; }

p {
  margin-bottom: 1rem;
  color: var(--text-light);
}

.lead {
  font-size: 1.25rem;
  color: var(--text-light);
}

/* === BOUTONS === */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-primary:hover {
  background: var(--primary-dark);
  border-color: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn-outline {
  background: transparent;
  color: var(--primary);
  border-color: var(--primary);
}

.btn-outline:hover {
  background: var(--primary);
  color: white;
}

.btn-white {
  background: white;
  color: var(--primary);
  border-color: white;
}

.btn-white:hover {
  background: var(--background-alt);
}

/* === NAVBAR === */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  transition: var(--transition);
}

.navbar.scrolled {
  box-shadow: var(--shadow);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
}

.nav-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.nav-menu {
  display: flex;
  gap: 32px;
}

.nav-link {
  font-weight: 500;
  color: var(--text);
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary);
  transition: var(--transition);
}

.nav-link:hover::after,
.nav-link.active::after {
  width: 100%;
}

.nav-link:hover,
.nav-link.active {
  color: var(--primary);
}

.nav-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
}

.nav-toggle span {
  width: 25px;
  height: 2px;
  background: var(--text);
  transition: var(--transition);
}

/* === HERO === */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--secondary) 0%, #16213e 100%);
  color: white;
  text-align: center;
  padding: 120px 24px 80px;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop') center/cover;
  opacity: 0.2;
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
}

.hero h1 {
  color: white;
  margin-bottom: 24px;
  animation: fadeInUp 0.8s ease;
}

.hero p {
  font-size: 1.25rem;
  color: rgba(255,255,255,0.9);
  margin-bottom: 32px;
  animation: fadeInUp 0.8s ease 0.2s both;
}

.hero-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  animation: fadeInUp 0.8s ease 0.4s both;
}

/* === CARDS === */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 32px;
}

.card {
  background: white;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-xl);
}

.card-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.card-content {
  padding: 24px;
}

.card-title {
  font-size: 1.25rem;
  margin-bottom: 12px;
}

.card-text {
  color: var(--text-light);
  margin-bottom: 16px;
}

/* === SERVICES === */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
}

.service-card {
  background: white;
  padding: 40px 32px;
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: var(--shadow);
  transition: var(--transition);
  border: 1px solid var(--border);
}

.service-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-xl);
  border-color: var(--primary);
}

.service-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: var(--primary-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--primary);
}

.service-card h3 {
  margin-bottom: 16px;
}

/* === ABOUT === */
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.about-image {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}

.about-content h2 {
  margin-bottom: 24px;
}

.about-content p {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-top: 32px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  color: var(--text-light);
  font-size: 0.875rem;
}

/* === CONTACT === */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
}

.contact-info h2 {
  margin-bottom: 24px;
}

.contact-item {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.contact-icon {
  width: 50px;
  height: 50px;
  background: var(--primary-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  flex-shrink: 0;
}

.contact-form {
  background: white;
  padding: 40px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  font-family: inherit;
  transition: var(--transition);
  background: var(--background);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.success-message {
  background: #10b981;
  color: white;
  padding: 20px;
  border-radius: var(--radius);
  text-align: center;
  font-weight: 500;
}

/* === FOOTER === */
.footer {
  background: var(--secondary);
  color: white;
  padding: 60px 0 30px;
  margin-top: auto;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 40px;
  margin-bottom: 40px;
}

.footer-col h4 {
  color: white;
  margin-bottom: 20px;
  font-size: 1.125rem;
}

.footer-col p,
.footer-col a {
  color: rgba(255,255,255,0.7);
  font-size: 0.9rem;
  line-height: 2;
}

.footer-col a:hover {
  color: var(--primary);
}

.footer-bottom {
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 30px;
  text-align: center;
  color: rgba(255,255,255,0.5);
  font-size: 0.875rem;
}

/* === PAGE HEADER === */
.page-header {
  background: linear-gradient(135deg, var(--secondary) 0%, #16213e 100%);
  color: white;
  padding: 160px 24px 80px;
  text-align: center;
}

.page-header h1 {
  color: white;
  margin-bottom: 16px;
}

.page-header p {
  color: rgba(255,255,255,0.8);
  font-size: 1.25rem;
}

/* === ANIMATIONS === */
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

.fade-in {
  animation: fadeIn 0.6s ease;
}

/* === RESPONSIVE === */
@media (max-width: 768px) {
  .nav-menu {
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: 24px;
    gap: 16px;
    box-shadow: var(--shadow-lg);
    transform: translateY(-100%);
    opacity: 0;
    visibility: hidden;
    transition: var(--transition);
  }
  
  .nav-menu.active {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
  }
  
  .nav-toggle {
    display: flex;
  }
  
  .nav-toggle.active span:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
  }
  
  .nav-toggle.active span:nth-child(2) {
    opacity: 0;
  }
  
  .nav-toggle.active span:nth-child(3) {
    transform: rotate(-45deg) translate(5px, -5px);
  }
  
  .hero {
    padding: 100px 24px 60px;
    min-height: auto;
  }
  
  .hero-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .about-grid,
  .contact-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  
  .section {
    padding: 60px 0;
  }
}

/* === ERROR PAGE === */
.error-page {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 120px 24px;
}

.error-page h1 {
  font-size: 8rem;
  color: var(--primary);
  margin-bottom: 16px;
}

.error-page p {
  font-size: 1.5rem;
  margin-bottom: 32px;
}

// FILE: /router.js
(function() {
  'use strict';
  
  window.Router = {
    routes: {},
    currentPath: '/',
    
    init: function() {
      var self = this;
      
      // Intercepter les clics sur les liens internes
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href^="/"]');
        if (link && !link.hasAttribute('target')) {
          e.preventDefault();
          var path = link.getAttribute('href');
          self.navigate(path);
        }
      });
      
      // Gérer le bouton retour/avant du navigateur
      window.addEventListener('popstate', function() {
        self.render(window.location.pathname);
      });
      
      // Menu mobile toggle
      var navToggle = document.querySelector('.nav-toggle');
      var navMenu = document.querySelector('.nav-menu');
      if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
          navToggle.classList.toggle('active');
          navMenu.classList.toggle('active');
        });
      }
      
      // Navbar scroll effect
      window.addEventListener('scroll', function() {
        var navbar = document.querySelector('.navbar');
        if (navbar) {
          if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
          } else {
            navbar.classList.remove('scrolled');
          }
        }
      });
      
      // Notifier l'iframe parent
      this.notifyParent();
      
      // Render initial
      this.render(window.location.pathname);
    },
    
    register: function(path, renderFn) {
      this.routes[path] = renderFn;
    },
    
    navigate: function(path) {
      if (path === this.currentPath) return;
      
      // Fermer le menu mobile si ouvert
      var navToggle = document.querySelector('.nav-toggle');
      var navMenu = document.querySelector('.nav-menu');
      if (navToggle && navMenu) {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
      }
      
      window.history.pushState({}, '', path);
      this.render(path);
      this.notifyParent();
    },
    
    render: function(path) {
      this.currentPath = path;
      var app = document.getElementById('app');
      var renderFn = this.routes[path] || this.routes['/404'] || this.routes['/'];
      
      if (renderFn && app) {
        app.innerHTML = renderFn();
        app.classList.add('fade-in');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Réinitialiser les event listeners
        this.bindEvents();
      }
      
      // Mettre à jour la nav active
      var navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(function(link) {
        var href = link.getAttribute('href');
        if (href === path || (path === '/' && href === '/')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    },
    
    bindEvents: function() {
      var self = this;
      
      // Formulaire de contact
      var form = document.getElementById('contact-form');
      if (form) {
        form.addEventListener('submit', function(e) {
          self.handleContactSubmit(e);
        });
      }
    },
    
    handleContactSubmit: async function(e) {
      e.preventDefault();
      var form = e.target;
      var formData = new FormData(form);
      var data = Object.fromEntries(formData);
      
      var btn = form.querySelector('button[type="submit"]');
      var originalText = btn.textContent;
      btn.textContent = 'Envoi en cours...';
      btn.disabled = true;
      
      try {
        var response = await fetch('${SUPABASE_URL}/rest/v1/project_contacts', {
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
          form.innerHTML = '<div class="success-message">Message envoye avec succes ! Nous vous repondrons rapidement.</div>';
        } else {
          throw new Error('Erreur serveur');
        }
      } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        alert('Erreur lors de l\\'envoi. Veuillez reessayer.');
      }
    },
    
    notifyParent: function() {
      try {
        window.parent.postMessage({
          type: 'spa-navigation',
          path: this.currentPath,
          canGoBack: window.history.length > 1,
          canGoForward: false
        }, '*');
      } catch (e) {}
    }
  };
})();

// FILE: /pages.js
// ========================================
// CONTENU DES PAGES - GENERE DYNAMIQUEMENT
// ========================================

// Page d'accueil
Router.register('/', function() {
  return '<section class="hero">' +
    '<div class="hero-content">' +
      '<h1>Bienvenue sur notre site</h1>' +
      '<p class="lead">Une description engageante de votre entreprise et de vos services. Nous sommes la pour vous accompagner dans tous vos projets.</p>' +
      '<div class="hero-buttons">' +
        '<a href="/services" class="btn btn-primary">Nos services</a>' +
        '<a href="/contact" class="btn btn-outline btn-white">Nous contacter</a>' +
      '</div>' +
    '</div>' +
  '</section>' +
  
  '<section class="section">' +
    '<div class="container">' +
      '<h2 class="text-center">Nos Services</h2>' +
      '<p class="text-center lead" style="max-width: 600px; margin: 0 auto 48px;">Decouvrez notre gamme complete de services professionnels adaptes a vos besoins.</p>' +
      '<div class="services-grid">' +
        '<div class="service-card">' +
          '<div class="service-icon">1</div>' +
          '<h3>Service Premium</h3>' +
          '<p>Une description detaillee de ce premier service et de ses avantages pour vos clients.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">2</div>' +
          '<h3>Expertise Metier</h3>' +
          '<p>Une description detaillee de ce deuxieme service et de la valeur ajoutee proposee.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">3</div>' +
          '<h3>Accompagnement</h3>' +
          '<p>Une description detaillee de ce troisieme service et de son impact positif.</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>' +
  
  '<section class="section section-alt">' +
    '<div class="container">' +
      '<div class="about-grid">' +
        '<img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop" alt="Notre equipe" class="about-image">' +
        '<div class="about-content">' +
          '<h2>Pourquoi nous choisir ?</h2>' +
          '<p>Avec plus de 10 ans d\\'experience dans notre domaine, nous avons developpe une expertise unique qui nous permet d\\'offrir des solutions sur mesure a nos clients.</p>' +
          '<p>Notre equipe passionnee s\\'engage a vous fournir un service d\\'excellence, avec une attention particuliere portee a chaque detail de votre projet.</p>' +
          '<a href="/about" class="btn btn-primary">En savoir plus</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>';
});

// Page Services
Router.register('/services', function() {
  return '<section class="page-header">' +
    '<h1>Nos Services</h1>' +
    '<p>Des solutions adaptees a tous vos besoins</p>' +
  '</section>' +
  
  '<section class="section">' +
    '<div class="container">' +
      '<div class="services-grid">' +
        '<div class="service-card">' +
          '<div class="service-icon">1</div>' +
          '<h3>Service Premium</h3>' +
          '<p>Description complete du service premium avec tous ses avantages et fonctionnalites detaillees.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">2</div>' +
          '<h3>Expertise Metier</h3>' +
          '<p>Description complete de notre expertise metier et comment elle peut beneficier a votre activite.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">3</div>' +
          '<h3>Accompagnement</h3>' +
          '<p>Description complete de notre service d\\'accompagnement personnalise pour votre reussite.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">4</div>' +
          '<h3>Innovation</h3>' +
          '<p>Description complete de nos solutions innovantes pour vous demarquer de la concurrence.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">5</div>' +
          '<h3>Support 24/7</h3>' +
          '<p>Description complete de notre support technique disponible a tout moment pour vous aider.</p>' +
        '</div>' +
        '<div class="service-card">' +
          '<div class="service-icon">6</div>' +
          '<h3>Formation</h3>' +
          '<p>Description complete de nos programmes de formation pour developper vos competences.</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>';
});

// Page A propos
Router.register('/about', function() {
  return '<section class="page-header">' +
    '<h1>A propos de nous</h1>' +
    '<p>Decouvrez notre histoire et nos valeurs</p>' +
  '</section>' +
  
  '<section class="section">' +
    '<div class="container">' +
      '<div class="about-grid">' +
        '<div class="about-content">' +
          '<h2>Notre Histoire</h2>' +
          '<p>Fondee en 2015, notre entreprise est nee d\\'une vision simple : offrir des services de qualite exceptionnelle tout en maintenant une relation de proximite avec nos clients.</p>' +
          '<p>Au fil des annees, nous avons su evoluer et nous adapter aux besoins changeants du marche, tout en restant fideles a nos valeurs fondatrices d\\'excellence, d\\'integrite et d\\'innovation.</p>' +
          '<div class="stats-grid">' +
            '<div class="stat-item">' +
              '<div class="stat-number">10+</div>' +
              '<div class="stat-label">Annees d\\'experience</div>' +
            '</div>' +
            '<div class="stat-item">' +
              '<div class="stat-number">500+</div>' +
              '<div class="stat-label">Clients satisfaits</div>' +
            '</div>' +
            '<div class="stat-item">' +
              '<div class="stat-number">50+</div>' +
              '<div class="stat-label">Experts dedies</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop" alt="Notre bureau" class="about-image">' +
      '</div>' +
    '</div>' +
  '</section>';
});

// Page Contact
Router.register('/contact', function() {
  return '<section class="page-header">' +
    '<h1>Contactez-nous</h1>' +
    '<p>Nous sommes a votre ecoute</p>' +
  '</section>' +
  
  '<section class="section">' +
    '<div class="container">' +
      '<div class="contact-grid">' +
        '<div class="contact-info">' +
          '<h2>Restons en contact</h2>' +
          '<p>N\\'hesitez pas a nous contacter pour toute question ou demande d\\'information. Notre equipe vous repondra dans les plus brefs delais.</p>' +
          '<div class="contact-item">' +
            '<div class="contact-icon">@</div>' +
            '<div>' +
              '<h4>Email</h4>' +
              '<p>contact@example.com</p>' +
            '</div>' +
          '</div>' +
          '<div class="contact-item">' +
            '<div class="contact-icon">T</div>' +
            '<div>' +
              '<h4>Telephone</h4>' +
              '<p>+33 1 23 45 67 89</p>' +
            '</div>' +
          '</div>' +
          '<div class="contact-item">' +
            '<div class="contact-icon">A</div>' +
            '<div>' +
              '<h4>Adresse</h4>' +
              '<p>123 Rue de l\\'Innovation<br>75001 Paris, France</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<form id="contact-form" class="contact-form">' +
          '<div class="form-group">' +
            '<label for="name">Nom complet</label>' +
            '<input type="text" id="name" name="name" required placeholder="Votre nom">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="email">Email</label>' +
            '<input type="email" id="email" name="email" required placeholder="votre@email.com">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="phone">Telephone (optionnel)</label>' +
            '<input type="tel" id="phone" name="phone" placeholder="+33 6 00 00 00 00">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="message">Message</label>' +
            '<textarea id="message" name="message" required placeholder="Comment pouvons-nous vous aider ?"></textarea>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" style="width: 100%;">Envoyer le message</button>' +
        '</form>' +
      '</div>' +
    '</div>' +
  '</section>';
});

// Page 404
Router.register('/404', function() {
  return '<section class="error-page">' +
    '<h1>404</h1>' +
    '<p>Oops ! La page que vous recherchez n\\'existe pas.</p>' +
    '<a href="/" class="btn btn-primary">Retour a l\\'accueil</a>' +
  '</section>';
});

// FILE: /app.js
// ========================================
// INITIALISATION DE L'APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialiser le router
  Router.init();
  
  // Animation au scroll (Intersection Observer)
  var observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observer les elements a animer
  function observeElements() {
    var elements = document.querySelectorAll('.service-card, .card, .about-content, .contact-form');
    elements.forEach(function(el) {
      observer.observe(el);
    });
  }
  
  observeElements();
  
  // Re-observer apres chaque navigation
  var originalRender = Router.render.bind(Router);
  Router.render = function(path) {
    originalRender(path);
    setTimeout(observeElements, 100);
  };
  
  console.log('Application initialisee avec succes !');
});

⚠️ INSTRUCTIONS CRITIQUES POUR LA GENERATION:

1. ADAPTER LE CONTENU au prompt de l'utilisateur (textes, images, couleurs si demandé)
2. Le CSS ci-dessus est un MINIMUM - ajouter plus de styles selon le design demandé
3. Personnaliser pages.js avec le contenu réel demandé
4. GARDER la structure des fichiers exactement comme indiquée
5. NE JAMAIS raccourcir le code avec "..." ou commentaires

📷 IMAGES UNSPLASH DISPONIBLES:
- Hero/Bureau: https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop
- Equipe: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop
- Hotel: https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop
- Nature: https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop
- Tech: https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop
- Immobilier: https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop
- Spa: https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop

FORMAT DE SORTIE STRICT - UTILISE EXACTEMENT CE FORMAT:
// FILE: /chemin/fichier.ext
[contenu COMPLET du fichier - JAMAIS de "..." ou raccourcis]

// FILE: /autre/fichier.ext
[contenu COMPLET]

Génère maintenant un site web STATIQUE MAGNIFIQUE, PROFESSIONNEL et COMPLET avec routing SPA, en ADAPTANT le contenu au prompt de l'utilisateur.`;

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
