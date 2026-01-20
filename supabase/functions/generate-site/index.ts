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

// ============= UTILITAIRES =============

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

// Détection du secteur d'activité pour fallback thématique
function detectSector(prompt: string): 'restaurant' | 'tech' | 'nature' | 'luxury' | 'health' | 'neutral' {
  const lower = prompt.toLowerCase();
  
  if (/restaurant|café|bistro|traiteur|cuisine|chef|menu|gastronomie|pizza|sushi|boulangerie|pâtisserie/i.test(lower)) {
    return 'restaurant';
  }
  if (/tech|startup|saas|logiciel|app|digital|agence web|développeur|code|ia|intelligence artificielle/i.test(lower)) {
    return 'tech';
  }
  if (/nature|bio|écolo|jardin|paysagiste|ferme|agriculture|plante|fleur|botanique/i.test(lower)) {
    return 'nature';
  }
  if (/luxe|premium|prestige|haut de gamme|bijou|montre|mode|fashion|immobilier luxe|villa/i.test(lower)) {
    return 'luxury';
  }
  if (/santé|médecin|dentiste|kiné|ostéo|clinique|cabinet|psychologue|bien-être|spa|massage/i.test(lower)) {
    return 'health';
  }
  
  return 'neutral';
}

// ============= CSS FALLBACKS THÉMATIQUES =============

const CSS_THEMES: Record<string, string> = {
  restaurant: `
  --primary: #d97706;
  --primary-dark: #b45309;
  --primary-light: rgba(217, 119, 6, 0.1);
  --secondary: #292524;
  --accent: #dc2626;`,
  
  tech: `
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --primary-light: rgba(99, 102, 241, 0.1);
  --secondary: #0f172a;
  --accent: #06b6d4;`,
  
  nature: `
  --primary: #16a34a;
  --primary-dark: #15803d;
  --primary-light: rgba(22, 163, 74, 0.1);
  --secondary: #1c1917;
  --accent: #84cc16;`,
  
  luxury: `
  --primary: #a16207;
  --primary-dark: #854d0e;
  --primary-light: rgba(161, 98, 7, 0.1);
  --secondary: #0c0a09;
  --accent: #f59e0b;`,
  
  health: `
  --primary: #0891b2;
  --primary-dark: #0e7490;
  --primary-light: rgba(8, 145, 178, 0.1);
  --secondary: #164e63;
  --accent: #14b8a6;`,
  
  neutral: `
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --primary-light: rgba(99, 102, 241, 0.1);
  --secondary: #1e293b;
  --accent: #f59e0b;`
};

function getThemedFallbackCSS(sector: string): string {
  const themeVars = CSS_THEMES[sector] || CSS_THEMES.neutral;
  
  return `/* ============================================
   FALLBACK CSS - Thème: ${sector}
   ============================================ */

:root {
  ${themeVars}
  --text: #1f2937;
  --text-light: #6b7280;
  --text-muted: #9ca3af;
  --background: #ffffff;
  --background-alt: #f9fafb;
  --background-dark: #111827;
  --border: #e5e7eb;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
  --radius-sm: 4px;
  --radius: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  --transition-fast: 150ms ease;
  --transition: 300ms ease;
  --transition-slow: 500ms ease;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; font-size: 16px; }
body { font-family: var(--font-sans); line-height: 1.6; color: var(--text); background: var(--background); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; transition: color var(--transition-fast); }
button { cursor: pointer; font-family: inherit; border: none; background: none; }
ul, ol { list-style: none; }

h1, h2, h3, h4, h5, h6 { font-weight: 700; line-height: 1.2; color: var(--secondary); }
h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
h2 { font-size: clamp(2rem, 4vw, 3rem); }
h3 { font-size: clamp(1.5rem, 3vw, 2rem); }
h4 { font-size: clamp(1.25rem, 2.5vw, 1.5rem); }
p { color: var(--text-light); margin-bottom: 1rem; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
.section { padding: 5rem 0; }
.section-header { text-align: center; margin-bottom: 4rem; }
.section-header h2 { margin-bottom: 1rem; }
.section-header p { max-width: 600px; margin: 0 auto; font-size: 1.125rem; }

.navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-bottom: 1px solid transparent; transition: var(--transition); }
.navbar.scrolled { background: rgba(255,255,255,0.98); border-bottom-color: var(--border); box-shadow: var(--shadow-sm); }
.navbar .container { display: flex; align-items: center; justify-content: space-between; height: 72px; }
.navbar .logo { font-size: 1.5rem; font-weight: 700; color: var(--secondary); }
.navbar .logo span { color: var(--primary); }
.nav-links { display: flex; align-items: center; gap: 2rem; }
.nav-links a { font-weight: 500; color: var(--text-light); transition: color var(--transition-fast); }
.nav-links a:hover { color: var(--primary); }
.mobile-toggle { display: none; flex-direction: column; gap: 5px; padding: 5px; cursor: pointer; }
.mobile-toggle span { display: block; width: 24px; height: 2px; background: var(--text); transition: var(--transition); }

@media (max-width: 768px) {
  .mobile-toggle { display: flex; }
  .nav-links { position: fixed; top: 72px; left: 0; right: 0; background: white; flex-direction: column; padding: 2rem; gap: 1.5rem; border-bottom: 1px solid var(--border); transform: translateY(-100%); opacity: 0; pointer-events: none; transition: var(--transition); }
  .nav-links.active { transform: translateY(0); opacity: 1; pointer-events: all; }
}

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.875rem 1.75rem; font-size: 1rem; font-weight: 600; border-radius: var(--radius); transition: var(--transition); }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-dark); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.btn-secondary { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
.btn-secondary:hover { background: var(--primary); color: white; }

.hero { min-height: 100vh; display: flex; align-items: center; padding-top: 72px; background: linear-gradient(135deg, var(--background) 0%, var(--background-alt) 100%); position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; top: -50%; right: -20%; width: 80%; height: 150%; background: radial-gradient(circle, var(--primary-light) 0%, transparent 70%); pointer-events: none; }
.hero .container { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; position: relative; z-index: 1; }
.hero-content h1 { margin-bottom: 1.5rem; }
.hero-content h1 span { color: var(--primary); }
.hero-content p { font-size: 1.25rem; margin-bottom: 2rem; max-width: 500px; }
.hero-buttons { display: flex; gap: 1rem; flex-wrap: wrap; }
.hero-image img { border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); }

@media (max-width: 968px) {
  .hero .container { grid-template-columns: 1fr; text-align: center; }
  .hero-content p { margin-left: auto; margin-right: auto; }
  .hero-buttons { justify-content: center; }
  .hero-image { max-width: 500px; margin: 0 auto; }
}

.card { background: white; border-radius: var(--radius-lg); padding: 2rem; box-shadow: var(--shadow); border: 1px solid var(--border); transition: var(--transition); }
.card:hover { transform: translateY(-5px); box-shadow: var(--shadow-xl); border-color: var(--primary-light); }
.card-icon { width: 60px; height: 60px; background: var(--primary-light); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
.card-icon svg { width: 28px; height: 28px; color: var(--primary); }
.card h3 { margin-bottom: 0.75rem; }

.services { background: var(--background-alt); }
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }

.about .container { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
.about-image img { border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); }
.about-content h2 { margin-bottom: 1.5rem; }
.about-features { margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem; }
.about-feature { display: flex; align-items: center; gap: 0.75rem; }
.about-feature svg { color: var(--primary); flex-shrink: 0; }

@media (max-width: 968px) {
  .about .container { grid-template-columns: 1fr; }
  .about-image { order: -1; max-width: 500px; margin: 0 auto; }
}

.testimonials { background: var(--secondary); color: white; }
.testimonials h2 { color: white; }
.testimonials p { color: rgba(255,255,255,0.7); }
.testimonial-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-lg); padding: 2rem; }
.testimonial-card:hover { background: rgba(255,255,255,0.1); border-color: var(--primary); }
.testimonial-text { font-size: 1.125rem; font-style: italic; margin-bottom: 1.5rem; color: rgba(255,255,255,0.9); }
.testimonial-author { display: flex; align-items: center; gap: 1rem; }
.testimonial-author img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
.testimonial-author-info h4 { color: white; font-size: 1rem; }
.testimonial-author-info span { color: var(--primary); font-size: 0.875rem; }

.contact .container { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
.contact-info h2 { margin-bottom: 1rem; }
.contact-methods { margin-top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
.contact-method { display: flex; align-items: center; gap: 1rem; }
.contact-method-icon { width: 48px; height: 48px; background: var(--primary-light); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; }
.contact-method-icon svg { color: var(--primary); }
.contact-form { background: white; padding: 2.5rem; border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text); }
.form-group input, .form-group textarea { width: 100%; padding: 0.875rem 1rem; border: 1px solid var(--border); border-radius: var(--radius); font-size: 1rem; font-family: inherit; transition: var(--transition); background: var(--background); }
.form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
.form-group textarea { min-height: 150px; resize: vertical; }
.contact-form .btn { width: 100%; }

@media (max-width: 968px) {
  .contact .container { grid-template-columns: 1fr; }
}

.footer { background: var(--secondary); color: white; padding: 4rem 0 2rem; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem; }
.footer-brand .logo { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
.footer-brand .logo span { color: var(--primary); }
.footer-brand p { color: rgba(255,255,255,0.6); max-width: 300px; }
.footer-links h4 { color: white; margin-bottom: 1.5rem; font-size: 1rem; }
.footer-links ul { display: flex; flex-direction: column; gap: 0.75rem; }
.footer-links a { color: rgba(255,255,255,0.6); transition: color var(--transition-fast); }
.footer-links a:hover { color: var(--primary); }
.footer-social { display: flex; gap: 1rem; margin-top: 1.5rem; }
.footer-social a { width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; transition: var(--transition); }
.footer-social a:hover { background: var(--primary); }
.footer-social svg { width: 20px; height: 20px; }
.footer-bottom { padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.footer-bottom p { color: rgba(255,255,255,0.5); margin: 0; font-size: 0.875rem; }

@media (max-width: 968px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 576px) { .footer-grid { grid-template-columns: 1fr; } .footer-bottom { flex-direction: column; text-align: center; } }

@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fadeIn 0.6s ease forwards; }
.animate-on-scroll { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
.animate-on-scroll.visible { opacity: 1; transform: translateY(0); }

.text-center { text-align: center; }
.text-primary { color: var(--primary); }
.bg-alt { background-color: var(--background-alt); }
.mt-4 { margin-top: 2rem; }
.mb-4 { margin-bottom: 2rem; }
.hidden { display: none; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.gap-4 { gap: 2rem; }
.rounded-lg { border-radius: var(--radius-lg); }
.shadow-lg { box-shadow: var(--shadow-lg); }

@media (max-width: 768px) { .hidden-mobile { display: none !important; } .section { padding: 3rem 0; } }
`;
}

// JS de base pour fallback
const BASE_JS = `document.addEventListener('DOMContentLoaded', function() {
  console.log('Site loaded');
  
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      mobileToggle.classList.toggle('active');
    });
  }
  
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu) navMenu.classList.remove('active');
      if (mobileToggle) mobileToggle.classList.remove('active');
    });
  });
  
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
  
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const btn = this.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = 'Envoi...';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = 'Envoyé ✓';
        btn.style.background = '#10b981';
        setTimeout(() => { btn.textContent = originalText; btn.style.background = ''; btn.disabled = false; this.reset(); }, 3000);
      }, 1500);
    });
  }
  
  document.querySelectorAll('.card, .service-card, .testimonial-card').forEach((el, i) => {
    el.classList.add('animate-on-scroll');
    el.style.animationDelay = (i * 0.1) + 's';
  });
});
`;

// ============= VALIDATION STRUCTURELLE =============

interface ValidationResult {
  valid: boolean;
  score: number;
  issues: string[];
}

function validateHTML(html: string): ValidationResult {
  const issues: string[] = [];
  let score = 0;
  
  // Sections requises
  const sections = [
    { id: 'hero', weight: 2 },
    { id: 'services', weight: 2 },
    { id: 'about', weight: 1 },
    { id: 'contact', weight: 2 },
    { id: 'footer', weight: 1 }
  ];
  
  for (const section of sections) {
    if (html.includes(`id="${section.id}"`) || html.includes(`class="${section.id}"`) || html.includes(`class=".*${section.id}.*"`)) {
      score += section.weight;
    } else {
      issues.push(`Section manquante: ${section.id}`);
    }
  }
  
  // Vérifications additionnelles
  if (html.includes('<nav') || html.includes('class="navbar"') || html.includes('class="nav-links"')) {
    score += 1;
  } else {
    issues.push('Navigation manquante');
  }
  
  if (html.includes('<form') || html.includes('contactForm')) {
    score += 1;
  } else {
    issues.push('Formulaire de contact manquant');
  }
  
  // Détection de problèmes
  if (html.includes('cdn.tailwindcss.com') || html.includes('tailwindcdn')) {
    issues.push('Tailwind CDN détecté (interdit)');
    score -= 5;
  }
  
  if (html.includes('<style>') && html.match(/<style[^>]*>[\s\S]{200,}<\/style>/)) {
    issues.push('Style inline important détecté (devrait être dans styles.css)');
  }
  
  return {
    valid: score >= 5 && !issues.some(i => i.includes('interdit')),
    score,
    issues
  };
}

function validateCSS(css: string): ValidationResult {
  const issues: string[] = [];
  let score = 0;
  
  const lines = css.split('\n').length;
  
  // Seuil minimum: 80 lignes pour un CSS professionnel
  if (lines >= 100) {
    score += 3;
  } else if (lines >= 50) {
    score += 1;
    issues.push(`CSS court (${lines} lignes, recommandé: 100+)`);
  } else {
    issues.push(`CSS trop court (${lines} lignes)`);
  }
  
  // Vérifications structurelles
  if (css.includes(':root') && css.includes('--primary')) {
    score += 2;
  } else {
    issues.push('Variables CSS manquantes (:root avec --primary)');
  }
  
  if (css.includes('@media')) {
    score += 2;
  } else {
    issues.push('Pas de media queries (responsive manquant)');
  }
  
  if (css.includes('.navbar') || css.includes('.nav-')) {
    score += 1;
  }
  
  if (css.includes('.hero')) {
    score += 1;
  }
  
  if (css.includes('.btn') || css.includes('button')) {
    score += 1;
  }
  
  return {
    valid: score >= 5,
    score,
    issues
  };
}

// ============= EXTRACTION ASSETS INLINE =============

function extractInlineAssets(html: string): { html: string; css: string; js: string } {
  let css = '';
  let js = '';
  let cleanedHtml = html;
  
  // Extraire tous les <style>
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    css += styleMatch[1].trim() + '\n\n';
  }
  cleanedHtml = cleanedHtml.replace(styleRegex, '');
  
  // Extraire tous les <script> inline (pas les externes)
  const scriptRegex = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const content = scriptMatch[1].trim();
    if (content && !content.includes('tailwind') && content.length > 20) {
      js += content + '\n\n';
    }
  }
  cleanedHtml = cleanedHtml.replace(scriptRegex, '');
  
  // Supprimer les scripts Tailwind CDN
  cleanedHtml = cleanedHtml.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<script[^>]*tailwindcss[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // S'assurer que les liens CSS/JS sont présents
  if (!cleanedHtml.includes('href="styles.css"') && !cleanedHtml.includes("href='styles.css'")) {
    cleanedHtml = cleanedHtml.replace('</head>', '  <link rel="stylesheet" href="styles.css">\n</head>');
  }
  if (!cleanedHtml.includes('src="app.js"') && !cleanedHtml.includes("src='app.js'")) {
    cleanedHtml = cleanedHtml.replace('</body>', '  <script src="app.js"></script>\n</body>');
  }
  
  return { html: cleanedHtml.trim(), css: css.trim(), js: js.trim() };
}

// ============= PARSING MULTI-FORMAT =============

function parseGeneratedCode(code: string, sector: string = 'neutral'): { files: ProjectFile[] } {
  let files: ProjectFile[] = [];
  
  console.log('[parseGeneratedCode] Input length:', code.length, '| Sector:', sector);
  
  let cleanedCode = code.trim();
  
  // Nettoyer les marqueurs markdown globaux
  if (cleanedCode.startsWith('```')) {
    cleanedCode = cleanedCode.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
  }
  
  // Support multi-format pour les marqueurs de fichiers
  const filePatterns = [
    /\/\/\s*FILE:\s*([^\n]+)/g,           // // FILE: path
    /\/\*\s*FILE:\s*([^\s*]+)\s*\*\//g,   // /* FILE: path */
    /^---\s*([^\n]+\.(?:html|css|js))\s*---$/gm,  // --- path ---
    /^#\s*FILE:\s*([^\n]+)/gm,            // # FILE: path
  ];
  
  let allMatches: { index: number; path: string; length: number }[] = [];
  
  for (const pattern of filePatterns) {
    let match;
    while ((match = pattern.exec(cleanedCode)) !== null) {
      allMatches.push({
        index: match.index,
        path: match[1].trim(),
        length: match[0].length
      });
    }
  }
  
  // Trier par position
  allMatches.sort((a, b) => a.index - b.index);
  
  // Dédupliquer par proximité
  const uniqueMatches = allMatches.filter((m, i) => {
    if (i === 0) return true;
    return m.index - allMatches[i - 1].index > 50;
  });
  
  if (uniqueMatches.length > 0) {
    console.log(`[parseGeneratedCode] Found ${uniqueMatches.length} FILE markers`);
    
    for (let i = 0; i < uniqueMatches.length; i++) {
      const match = uniqueMatches[i];
      let filePath = match.path;
      const startIndex = match.index + match.length;
      
      const nextMatch = uniqueMatches[i + 1];
      const endIndex = nextMatch ? nextMatch.index : cleanedCode.length;
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
  
  // Si aucun fichier trouvé avec marqueurs, chercher du HTML brut
  if (files.length === 0 && cleanedCode.includes('<!DOCTYPE html>')) {
    console.log('[parseGeneratedCode] No FILE markers found, extracting raw HTML');
    files.push({
      path: '/index.html',
      content: cleanedCode,
      type: 'html'
    });
  }
  
  // Appliquer les garanties de fichiers
  files = ensureRequiredFiles(files, sector);
  
  // Validation et logging
  const htmlFile = files.find(f => f.path === '/index.html');
  const cssFile = files.find(f => f.path === '/styles.css');
  
  if (htmlFile) {
    const htmlValidation = validateHTML(htmlFile.content);
    console.log(`[parseGeneratedCode] HTML validation: score=${htmlValidation.score}, valid=${htmlValidation.valid}`);
    if (htmlValidation.issues.length > 0) {
      console.log('  Issues:', htmlValidation.issues.join(', '));
    }
  }
  
  if (cssFile) {
    const cssValidation = validateCSS(cssFile.content);
    console.log(`[parseGeneratedCode] CSS validation: score=${cssValidation.score}, lines=${cssFile.content.split('\n').length}`);
    if (cssValidation.issues.length > 0) {
      console.log('  Issues:', cssValidation.issues.join(', '));
    }
  }
  
  console.log(`[parseGeneratedCode] Final files (${files.length}):`);
  for (const file of files) {
    console.log(`  - ${file.path}: ${file.content.length} chars, ${file.content.split('\n').length} lines`);
  }
  
  return { files };
}

// ============= GARANTIE DES FICHIERS REQUIS =============

function ensureRequiredFiles(files: ProjectFile[], sector: string = 'neutral'): ProjectFile[] {
  let cssFile = files.find(f => f.path === '/styles.css');
  const jsFile = files.find(f => f.path === '/app.js');
  const htmlFile = files.find(f => f.path === '/index.html');
  
  // Seuil minimum: 80 lignes de CSS
  const MIN_CSS_LINES = 80;
  
  // Si on a un seul HTML avec du contenu inline, extraire CSS/JS
  if (htmlFile && files.length === 1) {
    console.log('[ensureRequiredFiles] Extracting inline assets from single HTML file');
    const extracted = extractInlineAssets(htmlFile.content);
    
    htmlFile.content = extracted.html;
    
    const extractedCssLines = extracted.css.split('\n').length;
    
    if (extractedCssLines >= MIN_CSS_LINES) {
      console.log(`[ensureRequiredFiles] Using extracted CSS (${extractedCssLines} lines)`);
      files.push({ path: '/styles.css', content: extracted.css, type: 'stylesheet' });
    } else {
      console.log(`[ensureRequiredFiles] Extracted CSS too short (${extractedCssLines} lines), using ${sector} fallback`);
      files.push({ path: '/styles.css', content: getThemedFallbackCSS(sector), type: 'stylesheet' });
    }
    
    if (extracted.js && extracted.js.length > 100) {
      files.push({ path: '/app.js', content: extracted.js, type: 'javascript' });
    } else {
      files.push({ path: '/app.js', content: BASE_JS, type: 'javascript' });
    }
    
    return files;
  }
  
  // Vérifier et corriger le HTML existant
  if (htmlFile) {
    // Supprimer Tailwind CDN s'il est présent
    htmlFile.content = htmlFile.content.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, '');
    htmlFile.content = htmlFile.content.replace(/<script[^>]*tailwindcss[^>]*>[\s\S]*?<\/script>/gi, '');
  }
  
  // Vérifier que le CSS est suffisant
  if (cssFile) {
    const cssLines = cssFile.content.split('\n').length;
    if (cssLines < MIN_CSS_LINES) {
      console.log(`[ensureRequiredFiles] CSS file too short (${cssLines} lines), replacing with ${sector} fallback`);
      cssFile.content = getThemedFallbackCSS(sector);
    }
  } else {
    console.log(`[ensureRequiredFiles] No CSS file, adding ${sector} fallback`);
    files.push({ path: '/styles.css', content: getThemedFallbackCSS(sector), type: 'stylesheet' });
  }
  
  // Vérifier que le JS existe
  if (!jsFile) {
    console.log('[ensureRequiredFiles] No JS file, adding fallback');
    files.push({ path: '/app.js', content: BASE_JS, type: 'javascript' });
  } else if (jsFile.content.length < 100) {
    jsFile.content = BASE_JS;
  }
  
  // Fallback pour HTML manquant
  if (!htmlFile) {
    console.log('[ensureRequiredFiles] Adding minimal fallback index.html');
    files.push({
      path: '/index.html',
      content: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mon Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <section id="hero" class="hero">
      <div class="container">
        <h1>Bienvenue</h1>
        <p>Votre site est en cours de création...</p>
      </div>
    </section>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
      type: 'html'
    });
  }
  
  return files;
}

// ============= PROMPT OPTIMISÉ (SIMPLIFIÉ) =============

const SYSTEM_PROMPT = `Tu génères des sites vitrines statiques professionnels en HTML/CSS/JS vanilla.

FORMAT OBLIGATOIRE - Génère exactement 3 fichiers avec ces marqueurs :

// FILE: index.html
[HTML5 complet - toutes les sections visibles - AUCUN style/script inline]

// FILE: styles.css
[CSS custom MINIMUM 150 lignes - variables :root, responsive @media, animations]

// FILE: app.js
[JavaScript pour interactivité : menu mobile, scroll smooth, formulaire]

RÈGLES CRITIQUES :
1. HTML : Toutes les sections (hero, services, about, contact, footer) avec contenu réel
2. CSS : Variables :root (--primary, --secondary, etc.), min 150 lignes, responsive
3. JS : Menu mobile, smooth scroll, animations IntersectionObserver
4. INTERDIT : Tailwind CDN, classes Tailwind (flex, p-4, text-xl...), Bootstrap, frameworks CSS
5. Images : URLs Unsplash (https://images.unsplash.com/photo-XXX?auto=format&fit=crop&w=800)
6. Icônes : SVG inline uniquement

STRUCTURE HTML REQUISE :
- <header class="navbar"> avec navigation fixe
- <section id="hero"> avec titre accrocheur + CTA
- <section id="services"> avec minimum 3 services
- <section id="about"> présentation avec image
- <section id="contact"> avec formulaire
- <footer class="footer"> complet

LIBERTÉ CRÉATIVE TOTALE : Choisis librement le thème, les couleurs, le style (minimaliste, coloré, sombre, glassmorphism...). Crée un design moderne et professionnel unique.`;

// ============= HANDLER PRINCIPAL =============

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

    // Détecter le secteur pour fallback thématique
    const sector = detectSector(prompt);
    console.log(`[generate-site] User ${user.id} | Session ${sessionId} | Sector: ${sector} | Prompt: ${prompt.substring(0, 100)}...`);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Appel Claude API avec streaming + prefill pour forcer le format
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
        temperature: 0.5,  // Balance créativité/cohérence
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt },
          // Prefill pour forcer le format avec lien CSS inclus
          { role: 'assistant', content: '// FILE: index.html\n<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <link rel="stylesheet" href="styles.css">\n  <title>' }
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
          data: { sessionId, phase: 'analyzing', sector }
        })}\n\n`));

        // Générer le nom du projet en parallèle avec vérification d'unicité
        let projectName: string | null = null;
        
        const ensureUniqueName = async (baseName: string): Promise<string> => {
          // Vérifier si le nom existe déjà
          const { data: existingProjects, error } = await supabaseClient
            .from('build_sessions')
            .select('title')
            .ilike('title', `${baseName}%`);
          
          if (error) {
            console.error('[generate-site] Error checking name uniqueness:', error);
            // En cas d'erreur, ajouter un timestamp pour garantir l'unicité
            return `${baseName}-${Date.now().toString(36)}`;
          }
          
          if (!existingProjects || existingProjects.length === 0) {
            return baseName;
          }
          
          // Extraire les suffixes numériques existants
          const existingNames = existingProjects.map(p => p.title?.toLowerCase() || '');
          
          // Si le nom exact n'existe pas, le retourner
          if (!existingNames.includes(baseName.toLowerCase())) {
            return baseName;
          }
          
          // Trouver le prochain numéro disponible
          let suffix = 2;
          while (existingNames.includes(`${baseName.toLowerCase()}-${suffix}`)) {
            suffix++;
          }
          
          return `${baseName}-${suffix}`;
        };
        
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
                  content: `Génère un nom de projet court (2-4 mots max, format slug avec tirets). Pas de guillemets, pas de ponctuation. Sois créatif et unique.
Exemples: mon-cabinet-avocat, sportcoach-app, luxestate-immo, delice-bistro, techvision-lab
Pour: "${prompt.substring(0, 200)}"`
                }],
              }),
            });
            
            if (nameResponse.ok) {
              const data = await nameResponse.json();
              const rawName = data.content[0]?.text?.trim() || '';
              const baseName = rawName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 30);
              
              // Vérifier et garantir l'unicité du nom
              projectName = await ensureUniqueName(baseName);
              
              console.log('[generate-site] Generated unique project name:', projectName);
              
              if (sessionId && projectName) {
                await supabaseClient
                  .from('build_sessions')
                  .update({ title: projectName })
                  .eq('id', sessionId);
                
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'project_name',
                  data: { name: projectName }
                })}\n\n`));
              }
            } else {
              // Fallback avec timestamp si l'API échoue
              projectName = `projet-${Date.now().toString(36)}`;
              console.log('[generate-site] Using fallback project name:', projectName);
              
              if (sessionId) {
                await supabaseClient
                  .from('build_sessions')
                  .update({ title: projectName })
                  .eq('id', sessionId);
                
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'project_name',
                  data: { name: projectName }
                })}\n\n`));
              }
            }
          } catch (e) {
            console.error('[generate-site] Error generating project name:', e);
            // Fallback de dernier recours
            projectName = `projet-${Date.now().toString(36)}`;
            if (sessionId) {
              await supabaseClient
                .from('build_sessions')
                .update({ title: projectName })
                .eq('id', sessionId);
              
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'project_name',
                data: { name: projectName }
              })}\n\n`));
            }
          }
        };
        
        generateProjectName();

        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'generation_event',
          data: { type: 'analyze', message: 'Analyse de votre demande', status: 'in-progress', phase: 'analyzing' }
        })}\n\n`));

        const decoder = new TextDecoder();
        // Inclure le prefill dans le contenu accumulé
        let accumulated = '// FILE: index.html\n<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>';
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
                
                if (event.type === 'message_start' && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens || 0;
                }
                if (event.type === 'message_delta' && event.usage) {
                  outputTokens = event.usage.output_tokens || 0;
                }

                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  const text = event.delta.text || '';
                  accumulated += text;

                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'stream',
                    data: { text, phase: 'generating' }
                  })}\n\n`));
                  
                  // Parser progressivement
                  const parsed = parseGeneratedCode(accumulated, sector);
                  if (parsed.files.length > lastParsedFiles.length) {
                    lastParsedFiles = parsed.files;
                    
                    const filesRecord: Record<string, string> = {};
                    parsed.files.forEach(f => {
                      filesRecord[f.path] = f.content;
                    });
                    
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'files',
                      data: { files: filesRecord, phase: 'generating' }
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
          const finalParsed = parseGeneratedCode(accumulated, sector);
          lastParsedFiles = finalParsed.files;

          console.log('[generate-site] Final files:', lastParsedFiles.map(f => `${f.path} (${f.content.length} chars, ${f.content.split('\n').length} lines)`));

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
                business_sector: sector,
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
            data: { files: finalFilesRecord, phase: 'complete' }
          })}\n\n`));

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'tokens',
            data: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
          })}\n\n`));

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            data: { success: true, fileCount: lastParsedFiles.length, sector }
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
