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

// CSS COMPLET DE FALLBACK - Utilisé si le CSS généré est trop court
const COMPLETE_FALLBACK_CSS = `/* ============================================
   FALLBACK CSS - Site Vitrine Moderne
   ============================================ */

/* === VARIABLES CSS === */
:root {
  --primary: #03A5C0;
  --primary-dark: #028a9e;
  --primary-light: rgba(3, 165, 192, 0.1);
  --secondary: #1a1a2e;
  --accent: #ff6b6b;
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
  --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-heading: 'Inter', var(--font-sans);
}

/* === RESET & BASE === */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text);
  background: var(--background);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

a {
  text-decoration: none;
  color: inherit;
  transition: color var(--transition-fast);
}

button {
  cursor: pointer;
  font-family: inherit;
  border: none;
  background: none;
}

ul, ol {
  list-style: none;
}

/* === TYPOGRAPHY === */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 1.2;
  color: var(--secondary);
}

h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
h2 { font-size: clamp(2rem, 4vw, 3rem); }
h3 { font-size: clamp(1.5rem, 3vw, 2rem); }
h4 { font-size: clamp(1.25rem, 2.5vw, 1.5rem); }

p {
  color: var(--text-light);
  margin-bottom: 1rem;
}

/* === LAYOUT === */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.section {
  padding: 5rem 0;
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-header h2 {
  margin-bottom: 1rem;
}

.section-header p {
  max-width: 600px;
  margin: 0 auto;
  font-size: 1.125rem;
}

.grid {
  display: grid;
  gap: 2rem;
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }
  .section { padding: 3rem 0; }
}

/* === NAVIGATION === */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid transparent;
  transition: var(--transition);
}

.navbar.scrolled {
  background: rgba(255, 255, 255, 0.98);
  border-bottom-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.navbar .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}

.navbar .logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--secondary);
}

.navbar .logo span {
  color: var(--primary);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-links a {
  font-weight: 500;
  color: var(--text-light);
  transition: color var(--transition-fast);
}

.nav-links a:hover {
  color: var(--primary);
}

.mobile-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 5px;
  cursor: pointer;
}

.mobile-toggle span {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--text);
  transition: var(--transition);
}

@media (max-width: 768px) {
  .mobile-toggle { display: flex; }
  
  .nav-links {
    position: fixed;
    top: 72px;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: 2rem;
    gap: 1.5rem;
    border-bottom: 1px solid var(--border);
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: var(--transition);
  }
  
  .nav-links.active {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }
}

/* === BUTTONS === */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.75rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius);
  transition: var(--transition);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn-secondary {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
}

.btn-secondary:hover {
  background: var(--primary);
  color: white;
}

.btn-outline {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-outline:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* === HERO SECTION === */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding-top: 72px;
  background: linear-gradient(135deg, var(--background) 0%, var(--background-alt) 100%);
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 80%;
  height: 150%;
  background: radial-gradient(circle, var(--primary-light) 0%, transparent 70%);
  pointer-events: none;
}

.hero .container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-content h1 {
  margin-bottom: 1.5rem;
}

.hero-content h1 span {
  color: var(--primary);
}

.hero-content p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  max-width: 500px;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-image {
  position: relative;
}

.hero-image img {
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

@media (max-width: 968px) {
  .hero .container {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .hero-content p {
    margin-left: auto;
    margin-right: auto;
  }
  
  .hero-buttons {
    justify-content: center;
  }
  
  .hero-image {
    max-width: 500px;
    margin: 0 auto;
  }
}

/* === CARDS === */
.card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-xl);
  border-color: var(--primary-light);
}

.card-icon {
  width: 60px;
  height: 60px;
  background: var(--primary-light);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.card-icon svg {
  width: 28px;
  height: 28px;
  color: var(--primary);
}

.card h3 {
  margin-bottom: 0.75rem;
}

/* === SERVICES SECTION === */
.services {
  background: var(--background-alt);
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

/* === ABOUT SECTION === */
.about .container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.about-image img {
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

.about-content h2 {
  margin-bottom: 1.5rem;
}

.about-features {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.about-feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.about-feature svg {
  color: var(--primary);
  flex-shrink: 0;
}

@media (max-width: 968px) {
  .about .container {
    grid-template-columns: 1fr;
  }
  
  .about-image {
    order: -1;
    max-width: 500px;
    margin: 0 auto;
  }
}

/* === TESTIMONIALS === */
.testimonials {
  background: var(--secondary);
  color: white;
}

.testimonials h2 {
  color: white;
}

.testimonials p {
  color: rgba(255,255,255,0.7);
}

.testimonial-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-lg);
  padding: 2rem;
}

.testimonial-card:hover {
  background: rgba(255,255,255,0.1);
  border-color: var(--primary);
}

.testimonial-text {
  font-size: 1.125rem;
  font-style: italic;
  margin-bottom: 1.5rem;
  color: rgba(255,255,255,0.9);
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.testimonial-author img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.testimonial-author-info h4 {
  color: white;
  font-size: 1rem;
}

.testimonial-author-info span {
  color: var(--primary);
  font-size: 0.875rem;
}

/* === CONTACT SECTION === */
.contact .container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
}

.contact-info h2 {
  margin-bottom: 1rem;
}

.contact-methods {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-method {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.contact-method-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-light);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.contact-method-icon svg {
  color: var(--primary);
}

.contact-method h4 {
  font-size: 0.875rem;
  color: var(--text-light);
  font-weight: 500;
}

.contact-method p {
  margin: 0;
  color: var(--text);
  font-weight: 500;
}

.contact-form {
  background: white;
  padding: 2.5rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.875rem 1rem;
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
  min-height: 150px;
  resize: vertical;
}

.contact-form .btn {
  width: 100%;
}

@media (max-width: 968px) {
  .contact .container {
    grid-template-columns: 1fr;
  }
}

/* === FOOTER === */
.footer {
  background: var(--secondary);
  color: white;
  padding: 4rem 0 2rem;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-brand .logo {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.footer-brand .logo span {
  color: var(--primary);
}

.footer-brand p {
  color: rgba(255,255,255,0.6);
  max-width: 300px;
}

.footer-links h4 {
  color: white;
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.footer-links ul {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-links a {
  color: rgba(255,255,255,0.6);
  transition: color var(--transition-fast);
}

.footer-links a:hover {
  color: var(--primary);
}

.footer-social {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.footer-social a {
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,0.1);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.footer-social a:hover {
  background: var(--primary);
}

.footer-social svg {
  width: 20px;
  height: 20px;
}

.footer-bottom {
  padding-top: 2rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-bottom p {
  color: rgba(255,255,255,0.5);
  margin: 0;
  font-size: 0.875rem;
}

.footer-bottom-links {
  display: flex;
  gap: 2rem;
}

.footer-bottom-links a {
  color: rgba(255,255,255,0.5);
  font-size: 0.875rem;
}

.footer-bottom-links a:hover {
  color: var(--primary);
}

@media (max-width: 968px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 576px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
  
  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }
}

/* === ANIMATIONS === */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-fade-in {
  animation: fadeIn 0.6s ease forwards;
}

.animate-slide-left {
  animation: slideInLeft 0.6s ease forwards;
}

.animate-slide-right {
  animation: slideInRight 0.6s ease forwards;
}

.animate-scale-in {
  animation: scaleIn 0.5s ease forwards;
}

.animate-on-scroll {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.animate-on-scroll.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Animation delays */
.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }
.delay-500 { animation-delay: 0.5s; }

/* === UTILITIES === */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.text-primary { color: var(--primary); }
.text-secondary { color: var(--secondary); }
.text-muted { color: var(--text-muted); }

.bg-primary { background-color: var(--primary); }
.bg-secondary { background-color: var(--secondary); }
.bg-alt { background-color: var(--background-alt); }

.mt-1 { margin-top: 0.5rem; }
.mt-2 { margin-top: 1rem; }
.mt-3 { margin-top: 1.5rem; }
.mt-4 { margin-top: 2rem; }

.mb-1 { margin-bottom: 0.5rem; }
.mb-2 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 2rem; }

.py-1 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.py-2 { padding-top: 1rem; padding-bottom: 1rem; }
.py-3 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
.py-4 { padding-top: 2rem; padding-bottom: 2rem; }

.hidden { display: none; }
.block { display: block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }

.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }

.gap-1 { gap: 0.5rem; }
.gap-2 { gap: 1rem; }
.gap-3 { gap: 1.5rem; }
.gap-4 { gap: 2rem; }

.rounded { border-radius: var(--radius); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-full { border-radius: var(--radius-full); }

.shadow { box-shadow: var(--shadow); }
.shadow-lg { box-shadow: var(--shadow-lg); }
.shadow-xl { box-shadow: var(--shadow-xl); }

/* === RESPONSIVE HIDDEN === */
@media (max-width: 768px) {
  .hidden-mobile { display: none !important; }
}

@media (min-width: 769px) {
  .hidden-desktop { display: none !important; }
}
`;

// JS de base pour fallback
const BASE_JS = `document.addEventListener('DOMContentLoaded', function() {
  console.log('Site loaded successfully');
  
  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', function() {
      navMenu.classList.toggle('active');
      mobileToggle.classList.toggle('active');
    });
  }
  
  // Close mobile menu when clicking a link
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu) navMenu.classList.remove('active');
      if (mobileToggle) mobileToggle.classList.remove('active');
    });
  });
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  
  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }
  
  // Intersection Observer for scroll animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
  
  // Form handling
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      // Simulate form submission
      submitBtn.textContent = 'Envoi en cours...';
      submitBtn.disabled = true;
      
      setTimeout(() => {
        submitBtn.textContent = 'Message envoyé ✓';
        submitBtn.style.background = '#10b981';
        
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.style.background = '';
          submitBtn.disabled = false;
          contactForm.reset();
        }, 3000);
      }, 1500);
    });
  }
  
  // Add animation classes to elements
  const animateElements = document.querySelectorAll('.card, .service-card, .testimonial-card');
  animateElements.forEach((el, index) => {
    el.classList.add('animate-on-scroll');
    el.style.animationDelay = (index * 0.1) + 's';
  });
});
`;

// Supprimer les références Tailwind CDN du HTML
function removeTailwindCDN(html: string): string {
  // Supprimer script Tailwind CDN
  let cleaned = html.replace(/<script[^>]*src=["'][^"']*tailwindcss[^"']*["'][^>]*><\/script>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*src=["'][^"']*cdn\.tailwindcss[^"']*["'][^>]*><\/script>/gi, '');
  
  // Supprimer les configs tailwind inline
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?tailwind\.config[\s\S]*?<\/script>/gi, '');
  
  return cleaned;
}

// Extraire CSS et JS inline d'un HTML
function extractInlineAssets(htmlContent: string): { html: string; css: string; js: string } {
  let css = '';
  let js = '';
  let cleanedHtml = htmlContent;
  
  // D'abord supprimer Tailwind CDN
  cleanedHtml = removeTailwindCDN(cleanedHtml);
  
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
    if (trimmed && !trimmed.includes('tailwind.config') && !trimmed.includes('tailwindcss')) {
      js += trimmed + '\n\n';
    }
    return '';
  });
  
  // S'assurer que le HTML a les liens externes
  if (!cleanedHtml.includes('href="styles.css"') && !cleanedHtml.includes("href='/styles.css'") && !cleanedHtml.includes('href="/styles.css"')) {
    cleanedHtml = cleanedHtml.replace('</head>', '  <link rel="stylesheet" href="styles.css">\n</head>');
  }
  if (!cleanedHtml.includes('src="app.js"') && !cleanedHtml.includes("src='/app.js'") && !cleanedHtml.includes('src="/app.js"')) {
    cleanedHtml = cleanedHtml.replace('</body>', '  <script src="app.js"></script>\n</body>');
  }
  
  return { html: cleanedHtml.trim(), css: css.trim(), js: js.trim() };
}

// S'assurer que les 3 fichiers requis existent avec du contenu suffisant
function ensureRequiredFiles(files: ProjectFile[]): ProjectFile[] {
  const hasHtml = files.some(f => f.path === '/index.html');
  const cssFile = files.find(f => f.path === '/styles.css');
  const jsFile = files.find(f => f.path === '/app.js');
  
  // Si on a un seul HTML avec du contenu inline, extraire CSS/JS
  const htmlFile = files.find(f => f.path === '/index.html');
  if (htmlFile && files.length === 1) {
    console.log('[ensureRequiredFiles] Extracting inline assets from single HTML file');
    const extracted = extractInlineAssets(htmlFile.content);
    
    // Mettre à jour le HTML (supprimer Tailwind CDN si présent)
    htmlFile.content = removeTailwindCDN(extracted.html);
    
    // Vérifier si le CSS extrait est suffisant (> 500 chars)
    const extractedCssValid = extracted.css.length > 500;
    
    if (extractedCssValid) {
      files.push({ path: '/styles.css', content: extracted.css, type: 'stylesheet' });
    } else {
      console.log('[ensureRequiredFiles] CSS too short, using complete fallback CSS');
      files.push({ path: '/styles.css', content: COMPLETE_FALLBACK_CSS, type: 'stylesheet' });
    }
    
    // Ajouter JS extrait ou fallback
    if (extracted.js && extracted.js.length > 100) {
      files.push({ path: '/app.js', content: extracted.js, type: 'javascript' });
    } else {
      files.push({ path: '/app.js', content: BASE_JS, type: 'javascript' });
    }
    
    return files;
  }
  
  // Vérifier et corriger le HTML existant (supprimer Tailwind CDN)
  if (htmlFile) {
    htmlFile.content = removeTailwindCDN(htmlFile.content);
  }
  
  // Vérifier que le CSS est suffisant
  if (cssFile) {
    if (cssFile.content.length < 500) {
      console.log('[ensureRequiredFiles] CSS file too short, replacing with complete fallback');
      cssFile.content = COMPLETE_FALLBACK_CSS;
    }
  } else {
    console.log('[ensureRequiredFiles] No CSS file, adding complete fallback');
    files.push({ path: '/styles.css', content: COMPLETE_FALLBACK_CSS, type: 'stylesheet' });
  }
  
  // Vérifier que le JS existe
  if (!jsFile) {
    console.log('[ensureRequiredFiles] No JS file, adding fallback');
    files.push({ path: '/app.js', content: BASE_JS, type: 'javascript' });
  } else if (jsFile.content.length < 100) {
    jsFile.content = BASE_JS;
  }
  
  // Fallback pour HTML manquant
  if (!hasHtml) {
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
    <section class="hero">
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
  
  // Appliquer les fallbacks pour garantir les 3 fichiers avec contenu suffisant
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

    // PROMPT SYSTÈME - INTERDICTION TAILWIND CDN - CSS CUSTOM OBLIGATOIRE
    const systemPrompt = `Tu es un expert en développement web vanilla. Tu génères des sites vitrines statiques COMPLETS avec TOUT le contenu directement dans le HTML.

<OBJECTIF>

Créer un site vitrine ONE-PAGE complet et professionnel avec TOUTES les sections visibles dans le HTML :
- Header/Navigation fixe
- Section Hero avec titre accrocheur et CTA
- Section À propos / Présentation
- Section Services (minimum 3 services avec icônes SVG)
- Section Portfolio/Réalisations OU Témoignages
- Section Contact avec formulaire fonctionnel
- Footer complet

Tu es LIBRE sur le design, les couleurs, la mise en page, le thème - sois créatif et moderne.

</OBJECTIF>

<FORMAT_OBLIGATOIRE>

Génère EXACTEMENT 3 fichiers séparés, chacun précédé de son marqueur :

// FILE: index.html

[HTML COMPLET avec TOUT le contenu visible - hero, services, about, contact, footer]
[AUCUN <style> inline - tout le CSS va dans styles.css]
[AUCUN <script> inline - tout le JS va dans app.js]
[Liens: <link rel="stylesheet" href="styles.css"> et <script src="app.js"></script>]

// FILE: styles.css

[CSS CUSTOM COMPLET - MINIMUM 400 LIGNES]
[Variables CSS, reset, typography, layout, components, animations, responsive]
[Design moderne avec shadows, transitions, hover effects]

// FILE: app.js

[JavaScript pour interactions : menu mobile, scroll smooth, formulaire, animations]

</FORMAT_OBLIGATOIRE>

<RÈGLES_STRICTES>

1. UNIQUEMENT HTML5, CSS3 et JavaScript ES6+ vanilla - AUCUN framework

2. ⛔ JAMAIS DE TAILWIND CDN - PAS de <script src="cdn.tailwindcss.com">
   ⛔ JAMAIS de classes Tailwind (pas de p-4, flex, text-xl, bg-blue-500, etc.)
   ⛔ AUCUN framework CSS externe (Bootstrap, Bulma, etc.)

3. ✅ UNIQUEMENT du CSS custom écrit dans styles.css
   ✅ Minimum 400 lignes de CSS avec variables, animations, responsive

4. JAMAIS de JSX ou syntaxe React

5. JAMAIS de <style> dans le HTML - tout le CSS va dans styles.css

6. JAMAIS de <script> inline dans le HTML (sauf le lien vers app.js)

7. Navigation avec ancres href="#section" (ex: href="#services", href="#contact")

8. TOUT LE CONTENU DOIT ÊTRE VISIBLE DANS LE HTML - pas d'injection JavaScript

9. Code COMPLET et FONCTIONNEL - pas de TODO ou commentaires "à compléter"

10. Images : URLs Unsplash pertinentes (format: https://images.unsplash.com/photo-XXXXX?auto=format&fit=crop&w=800&q=80)

11. Icônes : SVG inline uniquement (pas de font-awesome ou autres)

</RÈGLES_STRICTES>

<STRUCTURE_CSS_OBLIGATOIRE>

Le fichier styles.css DOIT contenir au minimum :

/* === VARIABLES CSS === */
:root {
  --primary: [couleur];
  --primary-dark: [couleur];
  --secondary: [couleur];
  --text: [couleur];
  --background: [couleur];
  /* ... autres variables */
}

/* === RESET & BASE === */
*, *::before, *::after { ... }
html { scroll-behavior: smooth; }
body { font-family: ...; }

/* === TYPOGRAPHY === */
h1, h2, h3, h4, h5, h6 { ... }
p { ... }

/* === LAYOUT === */
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
.section { padding: 5rem 0; }

/* === NAVIGATION === */
.navbar { position: fixed; ... }
.nav-links { ... }
.mobile-toggle { display: none; } /* Visible en mobile */

/* === BUTTONS === */
.btn { ... }
.btn-primary { ... }
.btn-secondary { ... }

/* === HERO === */
.hero { min-height: 100vh; ... }

/* === CARDS === */
.card { ... }

/* === SECTIONS (services, about, testimonials, contact) === */
.services { ... }
.about { ... }
.testimonials { ... }
.contact { ... }

/* === FORMS === */
.form-group { ... }
.form-group input, .form-group textarea { ... }

/* === FOOTER === */
.footer { ... }

/* === ANIMATIONS === */
@keyframes fadeIn { ... }
.animate-on-scroll { ... }

/* === RESPONSIVE === */
@media (max-width: 968px) { ... }
@media (max-width: 768px) { ... }
@media (max-width: 576px) { ... }

</STRUCTURE_CSS_OBLIGATOIRE>

<ARCHITECTURE>

Le site est une ONE-PAGE avec scroll fluide entre sections :

index.html contient :
- <header class="navbar"> avec navigation fixe et liens ancres
- <section id="hero" class="hero"> : hero avec titre, sous-titre, boutons CTA
- <section id="services" class="section services"> : grille de services (minimum 3)
- <section id="about" class="section about"> : présentation avec image
- <section id="testimonials" class="section testimonials"> : avis clients
- <section id="contact" class="section contact"> : formulaire
- <footer class="footer"> : liens, contact, réseaux sociaux

</ARCHITECTURE>

<LIBERTÉ_CRÉATIVE>

Tu es TOTALEMENT LIBRE de choisir :

- Le thème du site (tech, restaurant, agence, portfolio, immobilier, santé, etc.)
- Les couleurs (palette harmonieuse - utilise des variables CSS)
- La typographie (Google Fonts recommandé)
- Le layout (grids, flexbox, asymétrique, etc.)
- Les animations (subtiles et professionnelles)
- Le style général (minimaliste, coloré, sombre, glassmorphism, neumorphism, etc.)
- Les images Unsplash pertinentes pour ton thème
- Les icônes SVG personnalisées

CRÉE un design moderne, cohérent et professionnel qui se démarque.

</LIBERTÉ_CRÉATIVE>

<INSTRUCTIONS_FINALES>

1. Génère 3 fichiers complets (index.html, styles.css, app.js)
2. styles.css doit faire MINIMUM 400 lignes avec tout le styling
3. AUCUNE référence à Tailwind, Bootstrap ou autre framework CSS
4. Design responsive (mobile-first)
5. Scroll fluide entre sections
6. Formulaire de contact avec validation visuelle
7. Animations avec IntersectionObserver

RAPPEL CRITIQUE :
- PAS DE TAILWIND CDN
- PAS DE CLASSES TAILWIND
- UNIQUEMENT CSS CUSTOM dans styles.css

</INSTRUCTIONS_FINALES>`;

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

          console.log('[generate-site] Final files:', lastParsedFiles.map(f => `${f.path} (${f.content.length} chars)`));

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
