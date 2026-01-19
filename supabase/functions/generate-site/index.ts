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
// IMPORTANT: Couleurs NEUTRES génériques - PAS de couleur Magellan
const COMPLETE_FALLBACK_CSS = `/* ============================================
   FALLBACK CSS - Site Vitrine Moderne
   Couleurs neutres - sera personnalisé par Claude
   ============================================ */

/* === VARIABLES CSS === */
:root {
  /* Couleurs NEUTRES génériques - Claude personnalisera selon le secteur */
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --primary-light: rgba(99, 102, 241, 0.1);
  --secondary: #1e293b;
  --accent: #f59e0b;
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

// Mappage Tailwind -> CSS équivalent pour les classes les plus courantes
const TAILWIND_TO_CSS: Record<string, string> = {
  // Flexbox
  'flex': 'display: flex',
  'inline-flex': 'display: inline-flex',
  'flex-col': 'flex-direction: column',
  'flex-row': 'flex-direction: row',
  'flex-wrap': 'flex-wrap: wrap',
  'flex-1': 'flex: 1 1 0%',
  'flex-auto': 'flex: 1 1 auto',
  'flex-none': 'flex: none',
  'grow': 'flex-grow: 1',
  'shrink-0': 'flex-shrink: 0',
  'items-center': 'align-items: center',
  'items-start': 'align-items: flex-start',
  'items-end': 'align-items: flex-end',
  'items-stretch': 'align-items: stretch',
  'justify-center': 'justify-content: center',
  'justify-between': 'justify-content: space-between',
  'justify-around': 'justify-content: space-around',
  'justify-evenly': 'justify-content: space-evenly',
  'justify-start': 'justify-content: flex-start',
  'justify-end': 'justify-content: flex-end',
  'self-center': 'align-self: center',
  'self-start': 'align-self: flex-start',
  'self-end': 'align-self: flex-end',
  // Grid
  'grid': 'display: grid',
  'grid-cols-1': 'grid-template-columns: repeat(1, minmax(0, 1fr))',
  'grid-cols-2': 'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'grid-cols-3': 'grid-template-columns: repeat(3, minmax(0, 1fr))',
  'grid-cols-4': 'grid-template-columns: repeat(4, minmax(0, 1fr))',
  'grid-cols-5': 'grid-template-columns: repeat(5, minmax(0, 1fr))',
  'grid-cols-6': 'grid-template-columns: repeat(6, minmax(0, 1fr))',
  'col-span-2': 'grid-column: span 2 / span 2',
  'col-span-3': 'grid-column: span 3 / span 3',
  'place-items-center': 'place-items: center',
  // Gap
  'gap-0': 'gap: 0',
  'gap-1': 'gap: 0.25rem',
  'gap-2': 'gap: 0.5rem',
  'gap-3': 'gap: 0.75rem',
  'gap-4': 'gap: 1rem',
  'gap-5': 'gap: 1.25rem',
  'gap-6': 'gap: 1.5rem',
  'gap-8': 'gap: 2rem',
  'gap-10': 'gap: 2.5rem',
  'gap-12': 'gap: 3rem',
  'gap-16': 'gap: 4rem',
  // Spacing - Padding
  'p-0': 'padding: 0',
  'p-1': 'padding: 0.25rem',
  'p-2': 'padding: 0.5rem',
  'p-3': 'padding: 0.75rem',
  'p-4': 'padding: 1rem',
  'p-5': 'padding: 1.25rem',
  'p-6': 'padding: 1.5rem',
  'p-8': 'padding: 2rem',
  'p-10': 'padding: 2.5rem',
  'p-12': 'padding: 3rem',
  'p-16': 'padding: 4rem',
  'p-20': 'padding: 5rem',
  'px-0': 'padding-left: 0; padding-right: 0',
  'px-1': 'padding-left: 0.25rem; padding-right: 0.25rem',
  'px-2': 'padding-left: 0.5rem; padding-right: 0.5rem',
  'px-3': 'padding-left: 0.75rem; padding-right: 0.75rem',
  'px-4': 'padding-left: 1rem; padding-right: 1rem',
  'px-5': 'padding-left: 1.25rem; padding-right: 1.25rem',
  'px-6': 'padding-left: 1.5rem; padding-right: 1.5rem',
  'px-8': 'padding-left: 2rem; padding-right: 2rem',
  'px-10': 'padding-left: 2.5rem; padding-right: 2.5rem',
  'py-0': 'padding-top: 0; padding-bottom: 0',
  'py-1': 'padding-top: 0.25rem; padding-bottom: 0.25rem',
  'py-2': 'padding-top: 0.5rem; padding-bottom: 0.5rem',
  'py-3': 'padding-top: 0.75rem; padding-bottom: 0.75rem',
  'py-4': 'padding-top: 1rem; padding-bottom: 1rem',
  'py-5': 'padding-top: 1.25rem; padding-bottom: 1.25rem',
  'py-6': 'padding-top: 1.5rem; padding-bottom: 1.5rem',
  'py-8': 'padding-top: 2rem; padding-bottom: 2rem',
  'py-10': 'padding-top: 2.5rem; padding-bottom: 2.5rem',
  'py-12': 'padding-top: 3rem; padding-bottom: 3rem',
  'py-16': 'padding-top: 4rem; padding-bottom: 4rem',
  'py-20': 'padding-top: 5rem; padding-bottom: 5rem',
  'pt-0': 'padding-top: 0',
  'pt-4': 'padding-top: 1rem',
  'pt-8': 'padding-top: 2rem',
  'pt-16': 'padding-top: 4rem',
  'pt-20': 'padding-top: 5rem',
  'pt-24': 'padding-top: 6rem',
  'pb-0': 'padding-bottom: 0',
  'pb-4': 'padding-bottom: 1rem',
  'pb-8': 'padding-bottom: 2rem',
  'pb-16': 'padding-bottom: 4rem',
  'pb-20': 'padding-bottom: 5rem',
  'pl-0': 'padding-left: 0',
  'pl-4': 'padding-left: 1rem',
  'pr-0': 'padding-right: 0',
  'pr-4': 'padding-right: 1rem',
  // Spacing - Margin
  'm-0': 'margin: 0',
  'm-auto': 'margin: auto',
  'm-1': 'margin: 0.25rem',
  'm-2': 'margin: 0.5rem',
  'm-4': 'margin: 1rem',
  'm-8': 'margin: 2rem',
  'mx-auto': 'margin-left: auto; margin-right: auto',
  'mx-0': 'margin-left: 0; margin-right: 0',
  'mx-2': 'margin-left: 0.5rem; margin-right: 0.5rem',
  'mx-4': 'margin-left: 1rem; margin-right: 1rem',
  'my-0': 'margin-top: 0; margin-bottom: 0',
  'my-2': 'margin-top: 0.5rem; margin-bottom: 0.5rem',
  'my-4': 'margin-top: 1rem; margin-bottom: 1rem',
  'my-8': 'margin-top: 2rem; margin-bottom: 2rem',
  'mt-0': 'margin-top: 0',
  'mt-1': 'margin-top: 0.25rem',
  'mt-2': 'margin-top: 0.5rem',
  'mt-4': 'margin-top: 1rem',
  'mt-6': 'margin-top: 1.5rem',
  'mt-8': 'margin-top: 2rem',
  'mt-10': 'margin-top: 2.5rem',
  'mt-12': 'margin-top: 3rem',
  'mt-16': 'margin-top: 4rem',
  'mb-0': 'margin-bottom: 0',
  'mb-1': 'margin-bottom: 0.25rem',
  'mb-2': 'margin-bottom: 0.5rem',
  'mb-4': 'margin-bottom: 1rem',
  'mb-6': 'margin-bottom: 1.5rem',
  'mb-8': 'margin-bottom: 2rem',
  'mb-10': 'margin-bottom: 2.5rem',
  'mb-12': 'margin-bottom: 3rem',
  'ml-0': 'margin-left: 0',
  'ml-2': 'margin-left: 0.5rem',
  'ml-4': 'margin-left: 1rem',
  'ml-auto': 'margin-left: auto',
  'mr-0': 'margin-right: 0',
  'mr-2': 'margin-right: 0.5rem',
  'mr-4': 'margin-right: 1rem',
  'mr-auto': 'margin-right: auto',
  // Width & Height
  'w-full': 'width: 100%',
  'w-auto': 'width: auto',
  'w-screen': 'width: 100vw',
  'w-1/2': 'width: 50%',
  'w-1/3': 'width: 33.333333%',
  'w-2/3': 'width: 66.666667%',
  'w-1/4': 'width: 25%',
  'w-3/4': 'width: 75%',
  'w-4': 'width: 1rem',
  'w-6': 'width: 1.5rem',
  'w-8': 'width: 2rem',
  'w-10': 'width: 2.5rem',
  'w-12': 'width: 3rem',
  'w-16': 'width: 4rem',
  'w-20': 'width: 5rem',
  'w-24': 'width: 6rem',
  'w-32': 'width: 8rem',
  'w-48': 'width: 12rem',
  'w-64': 'width: 16rem',
  'w-96': 'width: 24rem',
  'min-w-0': 'min-width: 0',
  'min-w-full': 'min-width: 100%',
  'max-w-xs': 'max-width: 20rem',
  'max-w-sm': 'max-width: 24rem',
  'max-w-md': 'max-width: 28rem',
  'max-w-lg': 'max-width: 32rem',
  'max-w-xl': 'max-width: 36rem',
  'max-w-2xl': 'max-width: 42rem',
  'max-w-3xl': 'max-width: 48rem',
  'max-w-4xl': 'max-width: 56rem',
  'max-w-5xl': 'max-width: 64rem',
  'max-w-6xl': 'max-width: 72rem',
  'max-w-7xl': 'max-width: 80rem',
  'max-w-full': 'max-width: 100%',
  'max-w-screen-xl': 'max-width: 1280px',
  'max-w-screen-2xl': 'max-width: 1536px',
  'h-full': 'height: 100%',
  'h-auto': 'height: auto',
  'h-screen': 'height: 100vh',
  'h-4': 'height: 1rem',
  'h-6': 'height: 1.5rem',
  'h-8': 'height: 2rem',
  'h-10': 'height: 2.5rem',
  'h-12': 'height: 3rem',
  'h-16': 'height: 4rem',
  'h-20': 'height: 5rem',
  'h-24': 'height: 6rem',
  'h-32': 'height: 8rem',
  'h-48': 'height: 12rem',
  'h-64': 'height: 16rem',
  'h-96': 'height: 24rem',
  'min-h-0': 'min-height: 0',
  'min-h-full': 'min-height: 100%',
  'min-h-screen': 'min-height: 100vh',
  // Typography
  'text-xs': 'font-size: 0.75rem; line-height: 1rem',
  'text-sm': 'font-size: 0.875rem; line-height: 1.25rem',
  'text-base': 'font-size: 1rem; line-height: 1.5rem',
  'text-lg': 'font-size: 1.125rem; line-height: 1.75rem',
  'text-xl': 'font-size: 1.25rem; line-height: 1.75rem',
  'text-2xl': 'font-size: 1.5rem; line-height: 2rem',
  'text-3xl': 'font-size: 1.875rem; line-height: 2.25rem',
  'text-4xl': 'font-size: 2.25rem; line-height: 2.5rem',
  'text-5xl': 'font-size: 3rem; line-height: 1',
  'text-6xl': 'font-size: 3.75rem; line-height: 1',
  'text-7xl': 'font-size: 4.5rem; line-height: 1',
  'font-thin': 'font-weight: 100',
  'font-light': 'font-weight: 300',
  'font-normal': 'font-weight: 400',
  'font-medium': 'font-weight: 500',
  'font-semibold': 'font-weight: 600',
  'font-bold': 'font-weight: 700',
  'font-extrabold': 'font-weight: 800',
  'italic': 'font-style: italic',
  'not-italic': 'font-style: normal',
  'uppercase': 'text-transform: uppercase',
  'lowercase': 'text-transform: lowercase',
  'capitalize': 'text-transform: capitalize',
  'normal-case': 'text-transform: none',
  'underline': 'text-decoration: underline',
  'line-through': 'text-decoration: line-through',
  'no-underline': 'text-decoration: none',
  'text-left': 'text-align: left',
  'text-center': 'text-align: center',
  'text-right': 'text-align: right',
  'text-justify': 'text-align: justify',
  'leading-none': 'line-height: 1',
  'leading-tight': 'line-height: 1.25',
  'leading-snug': 'line-height: 1.375',
  'leading-normal': 'line-height: 1.5',
  'leading-relaxed': 'line-height: 1.625',
  'leading-loose': 'line-height: 2',
  'tracking-tight': 'letter-spacing: -0.025em',
  'tracking-normal': 'letter-spacing: 0',
  'tracking-wide': 'letter-spacing: 0.025em',
  'tracking-wider': 'letter-spacing: 0.05em',
  'tracking-widest': 'letter-spacing: 0.1em',
  // Colors - Text
  'text-white': 'color: #ffffff',
  'text-black': 'color: #000000',
  'text-transparent': 'color: transparent',
  'text-gray-50': 'color: #f9fafb',
  'text-gray-100': 'color: #f3f4f6',
  'text-gray-200': 'color: #e5e7eb',
  'text-gray-300': 'color: #d1d5db',
  'text-gray-400': 'color: #9ca3af',
  'text-gray-500': 'color: #6b7280',
  'text-gray-600': 'color: #4b5563',
  'text-gray-700': 'color: #374151',
  'text-gray-800': 'color: #1f2937',
  'text-gray-900': 'color: #111827',
  'text-red-500': 'color: #ef4444',
  'text-red-600': 'color: #dc2626',
  'text-green-500': 'color: #22c55e',
  'text-green-600': 'color: #16a34a',
  'text-blue-500': 'color: #3b82f6',
  'text-blue-600': 'color: #2563eb',
  'text-cyan-500': 'color: #06b6d4',
  'text-cyan-600': 'color: #0891b2',
  'text-teal-500': 'color: #14b8a6',
  'text-teal-600': 'color: #0d9488',
  // Colors - Background
  'bg-white': 'background-color: #ffffff',
  'bg-black': 'background-color: #000000',
  'bg-transparent': 'background-color: transparent',
  'bg-gray-50': 'background-color: #f9fafb',
  'bg-gray-100': 'background-color: #f3f4f6',
  'bg-gray-200': 'background-color: #e5e7eb',
  'bg-gray-300': 'background-color: #d1d5db',
  'bg-gray-400': 'background-color: #9ca3af',
  'bg-gray-500': 'background-color: #6b7280',
  'bg-gray-600': 'background-color: #4b5563',
  'bg-gray-700': 'background-color: #374151',
  'bg-gray-800': 'background-color: #1f2937',
  'bg-gray-900': 'background-color: #111827',
  'bg-red-50': 'background-color: #fef2f2',
  'bg-red-500': 'background-color: #ef4444',
  'bg-green-50': 'background-color: #f0fdf4',
  'bg-green-500': 'background-color: #22c55e',
  'bg-blue-50': 'background-color: #eff6ff',
  'bg-blue-500': 'background-color: #3b82f6',
  'bg-blue-600': 'background-color: #2563eb',
  'bg-cyan-50': 'background-color: #ecfeff',
  'bg-cyan-500': 'background-color: #06b6d4',
  'bg-cyan-600': 'background-color: #0891b2',
  'bg-teal-50': 'background-color: #f0fdfa',
  'bg-teal-500': 'background-color: #14b8a6',
  'bg-teal-600': 'background-color: #0d9488',
  // Borders
  'border': 'border-width: 1px; border-style: solid',
  'border-0': 'border-width: 0',
  'border-2': 'border-width: 2px',
  'border-4': 'border-width: 4px',
  'border-t': 'border-top-width: 1px; border-style: solid',
  'border-b': 'border-bottom-width: 1px; border-style: solid',
  'border-l': 'border-left-width: 1px; border-style: solid',
  'border-r': 'border-right-width: 1px; border-style: solid',
  'border-solid': 'border-style: solid',
  'border-dashed': 'border-style: dashed',
  'border-dotted': 'border-style: dotted',
  'border-none': 'border-style: none',
  'border-gray-100': 'border-color: #f3f4f6',
  'border-gray-200': 'border-color: #e5e7eb',
  'border-gray-300': 'border-color: #d1d5db',
  'border-gray-400': 'border-color: #9ca3af',
  'border-white': 'border-color: #ffffff',
  'border-black': 'border-color: #000000',
  'border-transparent': 'border-color: transparent',
  'border-cyan-500': 'border-color: #06b6d4',
  'border-teal-500': 'border-color: #14b8a6',
  // Border Radius
  'rounded-none': 'border-radius: 0',
  'rounded-sm': 'border-radius: 0.125rem',
  'rounded': 'border-radius: 0.25rem',
  'rounded-md': 'border-radius: 0.375rem',
  'rounded-lg': 'border-radius: 0.5rem',
  'rounded-xl': 'border-radius: 0.75rem',
  'rounded-2xl': 'border-radius: 1rem',
  'rounded-3xl': 'border-radius: 1.5rem',
  'rounded-full': 'border-radius: 9999px',
  // Shadow
  'shadow-sm': 'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)',
  'shadow': 'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  'shadow-md': 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  'shadow-lg': 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  'shadow-xl': 'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  'shadow-2xl': 'box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)',
  'shadow-none': 'box-shadow: none',
  // Display
  'block': 'display: block',
  'inline-block': 'display: inline-block',
  'inline': 'display: inline',
  'hidden': 'display: none',
  'invisible': 'visibility: hidden',
  'visible': 'visibility: visible',
  // Position
  'static': 'position: static',
  'fixed': 'position: fixed',
  'absolute': 'position: absolute',
  'relative': 'position: relative',
  'sticky': 'position: sticky',
  'inset-0': 'inset: 0',
  'top-0': 'top: 0',
  'right-0': 'right: 0',
  'bottom-0': 'bottom: 0',
  'left-0': 'left: 0',
  'top-1/2': 'top: 50%',
  'left-1/2': 'left: 50%',
  '-translate-x-1/2': 'transform: translateX(-50%)',
  '-translate-y-1/2': 'transform: translateY(-50%)',
  'z-0': 'z-index: 0',
  'z-10': 'z-index: 10',
  'z-20': 'z-index: 20',
  'z-30': 'z-index: 30',
  'z-40': 'z-index: 40',
  'z-50': 'z-index: 50',
  // Overflow
  'overflow-auto': 'overflow: auto',
  'overflow-hidden': 'overflow: hidden',
  'overflow-visible': 'overflow: visible',
  'overflow-scroll': 'overflow: scroll',
  'overflow-x-auto': 'overflow-x: auto',
  'overflow-y-auto': 'overflow-y: auto',
  'overflow-x-hidden': 'overflow-x: hidden',
  'overflow-y-hidden': 'overflow-y: hidden',
  // Object
  'object-contain': 'object-fit: contain',
  'object-cover': 'object-fit: cover',
  'object-fill': 'object-fit: fill',
  'object-none': 'object-fit: none',
  'object-center': 'object-position: center',
  // Cursor
  'cursor-pointer': 'cursor: pointer',
  'cursor-default': 'cursor: default',
  'cursor-not-allowed': 'cursor: not-allowed',
  // Opacity
  'opacity-0': 'opacity: 0',
  'opacity-25': 'opacity: 0.25',
  'opacity-50': 'opacity: 0.5',
  'opacity-75': 'opacity: 0.75',
  'opacity-100': 'opacity: 1',
  // Transitions
  'transition': 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'transition-all': 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'transition-colors': 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'transition-opacity': 'transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'transition-transform': 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'duration-75': 'transition-duration: 75ms',
  'duration-100': 'transition-duration: 100ms',
  'duration-150': 'transition-duration: 150ms',
  'duration-200': 'transition-duration: 200ms',
  'duration-300': 'transition-duration: 300ms',
  'duration-500': 'transition-duration: 500ms',
  'ease-in': 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1)',
  'ease-out': 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1)',
  'ease-in-out': 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)',
  // Transform
  'transform': 'transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))',
  'scale-90': 'transform: scale(0.9)',
  'scale-95': 'transform: scale(0.95)',
  'scale-100': 'transform: scale(1)',
  'scale-105': 'transform: scale(1.05)',
  'scale-110': 'transform: scale(1.1)',
  'hover\\:scale-105': 'transform: scale(1.05)',
  'rotate-45': 'transform: rotate(45deg)',
  'rotate-90': 'transform: rotate(90deg)',
  'rotate-180': 'transform: rotate(180deg)',
  // Pointer Events
  'pointer-events-none': 'pointer-events: none',
  'pointer-events-auto': 'pointer-events: auto',
  // Select
  'select-none': 'user-select: none',
  'select-text': 'user-select: text',
  'select-all': 'user-select: all',
  // Whitespace
  'whitespace-normal': 'white-space: normal',
  'whitespace-nowrap': 'white-space: nowrap',
  'whitespace-pre': 'white-space: pre',
  'whitespace-pre-line': 'white-space: pre-line',
  'whitespace-pre-wrap': 'white-space: pre-wrap',
  // List
  'list-none': 'list-style-type: none',
  'list-disc': 'list-style-type: disc',
  'list-decimal': 'list-style-type: decimal',
  'list-inside': 'list-style-position: inside',
  'list-outside': 'list-style-position: outside',
  // Space between (approximations)
  'space-x-1': 'column-gap: 0.25rem',
  'space-x-2': 'column-gap: 0.5rem',
  'space-x-4': 'column-gap: 1rem',
  'space-x-6': 'column-gap: 1.5rem',
  'space-y-1': 'row-gap: 0.25rem',
  'space-y-2': 'row-gap: 0.5rem',
  'space-y-4': 'row-gap: 1rem',
  'space-y-6': 'row-gap: 1.5rem',
  // Aspect ratio
  'aspect-square': 'aspect-ratio: 1 / 1',
  'aspect-video': 'aspect-ratio: 16 / 9',
  'aspect-auto': 'aspect-ratio: auto',
  // Filters
  'backdrop-blur': 'backdrop-filter: blur(8px)',
  'backdrop-blur-sm': 'backdrop-filter: blur(4px)',
  'backdrop-blur-md': 'backdrop-filter: blur(12px)',
  'backdrop-blur-lg': 'backdrop-filter: blur(16px)',
  'backdrop-blur-xl': 'backdrop-filter: blur(24px)',
  // Outline
  'outline-none': 'outline: 2px solid transparent; outline-offset: 2px',
  'ring-0': 'box-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color)',
  'ring-1': 'box-shadow: 0 0 0 1px',
  'ring-2': 'box-shadow: 0 0 0 2px',
  // Focus ring (simplified)
  'focus\\:outline-none': 'outline: none',
  'focus\\:ring-2': 'box-shadow: 0 0 0 2px',
};

// Générer du CSS utilitaire à partir des classes Tailwind utilisées dans le HTML
function generateTailwindCSS(html: string): string {
  const usedClasses = new Set<string>();
  
  // Extraire toutes les classes du HTML
  const classRegex = /class=["']([^"']+)["']/g;
  let match;
  while ((match = classRegex.exec(html)) !== null) {
    const classes = match[1].split(/\s+/);
    classes.forEach(cls => usedClasses.add(cls.trim()));
  }
  
  // Générer le CSS pour chaque classe utilisée
  let generatedCSS = `/* === AUTO-GENERATED TAILWIND UTILITIES === */\n\n`;
  let rulesGenerated = 0;
  
  for (const cls of usedClasses) {
    if (TAILWIND_TO_CSS[cls]) {
      generatedCSS += `.${cls.replace(/[:\\]/g, '\\\\$&')} { ${TAILWIND_TO_CSS[cls]}; }\n`;
      rulesGenerated++;
    }
    
    // Gérer les classes hover:*
    if (cls.startsWith('hover:')) {
      const baseClass = cls.replace('hover:', '');
      if (TAILWIND_TO_CSS[baseClass]) {
        generatedCSS += `.${cls.replace(/:/g, '\\:')}:hover { ${TAILWIND_TO_CSS[baseClass]}; }\n`;
        rulesGenerated++;
      }
    }
    
    // Gérer les classes focus:*
    if (cls.startsWith('focus:')) {
      const baseClass = cls.replace('focus:', '');
      if (TAILWIND_TO_CSS[baseClass]) {
        generatedCSS += `.${cls.replace(/:/g, '\\:')}:focus { ${TAILWIND_TO_CSS[baseClass]}; }\n`;
        rulesGenerated++;
      }
    }
    
    // Gérer les classes md:* et lg:* (responsive)
    if (cls.startsWith('md:')) {
      const baseClass = cls.replace('md:', '');
      if (TAILWIND_TO_CSS[baseClass]) {
        generatedCSS += `@media (min-width: 768px) { .${cls.replace(/:/g, '\\:')} { ${TAILWIND_TO_CSS[baseClass]}; } }\n`;
        rulesGenerated++;
      }
    }
    if (cls.startsWith('lg:')) {
      const baseClass = cls.replace('lg:', '');
      if (TAILWIND_TO_CSS[baseClass]) {
        generatedCSS += `@media (min-width: 1024px) { .${cls.replace(/:/g, '\\:')} { ${TAILWIND_TO_CSS[baseClass]}; } }\n`;
        rulesGenerated++;
      }
    }
    if (cls.startsWith('xl:')) {
      const baseClass = cls.replace('xl:', '');
      if (TAILWIND_TO_CSS[baseClass]) {
        generatedCSS += `@media (min-width: 1280px) { .${cls.replace(/:/g, '\\:')} { ${TAILWIND_TO_CSS[baseClass]}; } }\n`;
        rulesGenerated++;
      }
    }
  }
  
  console.log(`[generateTailwindCSS] Generated ${rulesGenerated} utility CSS rules from ${usedClasses.size} classes`);
  
  return rulesGenerated > 0 ? generatedCSS : '';
}

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
  let cssFile = files.find(f => f.path === '/styles.css');
  const jsFile = files.find(f => f.path === '/app.js');
  
  // Si on a un seul HTML avec du contenu inline, extraire CSS/JS
  const htmlFile = files.find(f => f.path === '/index.html');
  if (htmlFile && files.length === 1) {
    console.log('[ensureRequiredFiles] Extracting inline assets from single HTML file');
    const extracted = extractInlineAssets(htmlFile.content);
    
    // Mettre à jour le HTML (supprimer Tailwind CDN si présent)
    htmlFile.content = removeTailwindCDN(extracted.html);
    
    // Générer du CSS utilitaire à partir des classes Tailwind utilisées dans le HTML
    const tailwindCSS = generateTailwindCSS(htmlFile.content);
    console.log(`[ensureRequiredFiles] Generated ${tailwindCSS.length} chars of Tailwind utility CSS`);
    
    // Combiner le CSS extrait + CSS Tailwind généré + fallback si nécessaire
    let finalCSS = '';
    
    // Accepter le CSS généré même s'il est court (seuil réduit de 500 à 100 chars)
    if (extracted.css.length > 100) {
      console.log(`[ensureRequiredFiles] Using extracted CSS (${extracted.css.length} chars)`);
      finalCSS = extracted.css;
    } else {
      console.log('[ensureRequiredFiles] CSS too short (<100 chars), using neutral fallback CSS');
      finalCSS = COMPLETE_FALLBACK_CSS;
    }
    
    // Ajouter toujours le CSS Tailwind généré s'il existe
    if (tailwindCSS.length > 0) {
      finalCSS = finalCSS + '\n\n' + tailwindCSS;
    }
    
    files.push({ path: '/styles.css', content: finalCSS, type: 'stylesheet' });
    
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
    
    // Générer du CSS Tailwind si le HTML utilise des classes Tailwind
    const tailwindCSS = generateTailwindCSS(htmlFile.content);
    if (tailwindCSS.length > 0) {
      console.log(`[ensureRequiredFiles] Generated ${tailwindCSS.length} chars of Tailwind utility CSS`);
      
      // Ajouter au CSS existant ou créer un nouveau fichier
      if (cssFile) {
        cssFile.content = cssFile.content + '\n\n' + tailwindCSS;
      } else {
        files.push({ path: '/styles.css', content: COMPLETE_FALLBACK_CSS + '\n\n' + tailwindCSS, type: 'stylesheet' });
        cssFile = files.find(f => f.path === '/styles.css');
      }
    }
  }
  
  // Vérifier que le CSS est suffisant (seuil réduit de 500 à 100)
  if (cssFile) {
    if (cssFile.content.length < 100) {
      console.log('[ensureRequiredFiles] CSS file too short (<100 chars), replacing with neutral fallback');
      cssFile.content = COMPLETE_FALLBACK_CSS;
    }
  } else {
    console.log('[ensureRequiredFiles] No CSS file, adding neutral fallback');
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
        temperature: 0.7,  // Plus de créativité pour couleurs et design variés
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
