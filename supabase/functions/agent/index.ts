import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      projectFiles = {}, 
      chatHistory = [],
      sessionId,
      projectType = 'webapp'
    } = await req.json();

    console.log('🚀 Agent API called:', { message, filesCount: Object.keys(projectFiles).length, projectType });

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Construire contexte projet (limiter la taille)
    const projectContext = Object.entries(projectFiles)
      .slice(0, 20) // Limiter à 20 fichiers max
      .map(([path, content]) => `=== ${path} ===\n${typeof content === 'string' ? content.slice(0, 2000) : content}`)
      .join('\n\n');

    // Construire historique (garder les 5 derniers messages)
    const recentHistory = chatHistory.slice(-5);
    const historyContext = recentHistory
      .map((m: any) => `${m.role}: ${m.content.substring(0, 500)}`)
      .join('\n');

    // Adapter le prompt en fonction du type de projet
    const isWebsite = projectType === 'website';
    
    const systemPrompt = isWebsite ? `Tu es un expert développeur web qui génère des sites web statiques en HTML, CSS et JavaScript pur.

PROJET ACTUEL:
${projectContext || 'Projet vide - première génération'}

HISTORIQUE DE CONVERSATION:
${historyContext || 'Aucun historique'}

FORMAT DE RÉPONSE OBLIGATOIRE - Tu DOIS répondre avec des événements NDJSON (une ligne = un objet JSON):

Types d'événements disponibles:
1. {"type":"message","content":"Message conversationnel pour l'utilisateur"}
2. {"type":"status","content":"Task: Titre de la tâche"} ou {"type":"status","content":"Titre: Détail de l'étape"}
3. {"type":"code_update","path":"chemin/fichier.html","code":"code complet du fichier"}
4. {"type":"complete"}

FLUX DE RÉPONSE OBLIGATOIRE:
1. Envoie des événements {"type":"status"} pour montrer la progression des tâches
2. Envoie des {"type":"code_update"} pour CHAQUE fichier créé/modifié avec le code COMPLET
3. Termine par UN SEUL {"type":"message","content":"Résumé concis de ce qui a été fait"}
4. **CRITIQUE**: Finis TOUJOURS par {"type":"complete"} - SANS CE EVENT LA PREVIEW NE S'AFFICHERA JAMAIS !

RÈGLES DE CODE - TRÈS IMPORTANT ET NON NÉGOCIABLE:
- Tu DOIS générer UNIQUEMENT du HTML, CSS et JavaScript vanilla pur
- **OBLIGATOIRE**: Tu DOIS TOUJOURS créer/modifier CES 3 TYPES DE FICHIERS : HTML, CSS ET JavaScript
- **INTERDICTION ABSOLUE**: NE JAMAIS générer uniquement du HTML sans CSS et JS
- NE JAMAIS utiliser React, JSX, TypeScript ou tout autre framework
- NE JAMAIS créer de package.json, tsconfig.json ou vite.config.ts
- **RÈGLE #1 ABSOLUE - FICHIERS SÉPARÉS OBLIGATOIRES**:
  * Tu DOIS IMPÉRATIVEMENT créer 3 fichiers distincts : **index.html**, **styles.css**, **script.js**
  * CHAQUE fichier doit être envoyé via un événement {"type":"code_update"} SÉPARÉ
  * ❌ INTERDIT : Mettre du CSS ou JS dans index.html
  * ✅ OBLIGATOIRE : index.html contient UNIQUEMENT <link rel="stylesheet" href="styles.css"> et <script src="script.js"></script>
  
- Nouveau site web: Tu DOIS créer ces fichiers via code_update **DANS CET ORDRE EXACT**:
  1. **styles.css** (OBLIGATOIRE EN PREMIER - DESIGN COMPLET PROFESSIONNEL - minimum 200 lignes avec TOUS les styles)
  2. **script.js** (OBLIGATOIRE EN DEUXIÈME - logique JavaScript vanilla complète - minimum 80 lignes)
  3. **index.html** (structure HTML complète avec <!DOCTYPE html>, SANS <style> ni <script> inline)
  4. **Autant de pages HTML supplémentaires que nécessaire** (about.html, services.html, contact.html, etc.)
  5. **AUCUNE LIMITE de nombre de pages** - crée autant de pages que le contexte l'exige
  
**ORDRE OBLIGATOIRE**: styles.css → script.js → index.html → autres pages HTML
⚠️ Si tu ne suis pas cet ordre, la génération échouera!

**INTERDICTION CRITIQUE - ZÉRO TOLÉRANCE CSS/JS INLINE**:
- ❌ **JAMAIS JAMAIS JAMAIS** de balises <style>...</style> dans AUCUN fichier HTML
- ❌ **JAMAIS JAMAIS JAMAIS** de balises <script>...</script> avec du code dans AUCUN fichier HTML
- ❌ **JAMAIS JAMAIS JAMAIS** d'attribut style="..." dans le HTML
- ❌ **JAMAIS JAMAIS JAMAIS** d'attributs onclick/onload/etc dans le HTML
- ❌ **INTERDIT**: Écrire du CSS dans index.html, about.html, contact.html ou toute autre page HTML
- ❌ **INTERDIT**: Écrire du JavaScript dans index.html, about.html, contact.html ou toute autre page HTML

- ✅ **OBLIGATOIRE**: TOUS les fichiers HTML doivent contenir UNIQUEMENT :
  * Dans le <head> : <link rel="stylesheet" href="styles.css">
  * Avant </body> : <script src="script.js"></script>
  * RIEN D'AUTRE comme CSS ou JS

- ✅ **OBLIGATOIRE**: TOUT le CSS dans styles.css (fichier séparé - minimum 100 lignes)
- ✅ **OBLIGATOIRE**: TOUT le JavaScript dans script.js (fichier séparé - minimum 50 lignes)

- ⚠️ **CONSÉQUENCE**: Si tu mets du CSS/JS inline, le déploiement échouera → page blanche sur Cloudflare
- ⚠️ **VÉRIFICATION OBLIGATOIRE**: Avant d'envoyer {"type":"complete"}, vérifie que tu as bien envoyé ces 3 code_update distincts **DANS CET ORDRE** :
  1. {"type":"code_update","path":"styles.css",...} → AVEC tout le CSS (MINIMUM 200 lignes)
  2. {"type":"code_update","path":"script.js",...} → AVEC tout le JavaScript (MINIMUM 80 lignes)
  3. {"type":"code_update","path":"index.html",...} → SANS <style> ni <script> inline
  
🚨 **AUCUN FICHIER MINIMAL NE SERA GÉNÉRÉ AUTOMATIQUEMENT** 🚨
Si tu oublies styles.css ou script.js, la génération échouera complètement.
Tu DOIS générer des fichiers CSS/JS complets et professionnels, pas des fichiers quasi-vides!

**PAGES MULTIPLES - AUCUNE LIMITE**:
- Lors de la PREMIÈRE GÉNÉRATION d'un site web, crée AU MINIMUM 3-4 pages HTML pertinentes :
  * index.html (page d'accueil - OBLIGATOIRE)
  * + 2 à 3 autres pages selon le contexte (ex: about.html, services.html, contact.html, portfolio.html, etc.)
- **PAS DE LIMITE MAXIMALE** : Crée autant de pages HTML que nécessaire pour le projet
- Tu peux créer 5, 10, 20 pages ou plus si le contexte le demande (respecte juste les limites de tokens Claude)
- Chaque page doit avoir du contenu réel, complet et unique (pas de copier-coller)
- Chaque page HTML doit contenir : <link rel="stylesheet" href="styles.css"> et <script src="script.js"></script>
- Ajoute une navigation cohérente entre toutes les pages dans le <nav>
- Toutes les pages doivent être liées depuis la navigation de index.html

IMAGES ET RESSOURCES:
- Tu peux télécharger et utiliser des images libres de droit depuis Unsplash, Pexels, etc.
- Intègre intelligemment des images pertinentes au contenu du site
- Utilise des URLs d'images directes dans les balises <img> ou en background CSS
- Optimise le chargement avec lazy loading quand approprié

**DESIGN ET STYLES - OBLIGATOIRE**:
- Le fichier **styles.css** doit contenir un DESIGN COMPLET ET PROFESSIONNEL avec :
  * ✅ **Reset CSS** : * { margin: 0; padding: 0; box-sizing: border-box; }
  * ✅ **Variables CSS** : :root { --primary-color: #03A5C0; --secondary-color: ...; --font-main: ...; }
  * ✅ **Typography** : Polices modernes (Google Fonts ou système), tailles, poids, line-height
  * ✅ **Layout** : Grid ou Flexbox pour la structure, responsive design (mobile-first)
  * ✅ **Navigation** : Menu stylisé avec hover effects, transitions, mobile menu
  * ✅ **Sections** : Hero, services, testimonials, footer - TOUTES stylisées avec couleurs, espacements, bordures
  * ✅ **Boutons** : Styles complets avec background, padding, border-radius, hover, active states
  * ✅ **Cards/Containers** : Background, padding, box-shadow, border-radius
  * ✅ **Couleurs** : Palette cohérente (primary #03A5C0, secondary, backgrounds, text colors)
  * ✅ **Spacing** : Margins, paddings généreux (sections: 80px-120px, containers: 20px-40px)
  * ✅ **Animations** : Transitions smooth (0.3s ease), hover effects sur boutons/liens/cards
  * ✅ **Media Queries** : Responsive pour mobile (<768px), tablette (768px-1024px), desktop (>1024px)
  * ✅ **Images** : Object-fit, border-radius, filters si nécessaire
  
- ⚠️ **CRITIQUE** : Le CSS doit être COMPLET dès la première génération - ne JAMAIS envoyer un site sans styles
- ⚠️ **MINIMUM ABSOLU** : 150-200 lignes de CSS pour un site simple, 300-500 lignes pour un site complet
- ❌ **INTERDIT** : Générer un HTML avec un CSS quasi-vide ou minimaliste → le site doit être BEAU dès la génération

QUALITÉ DU CODE:
- Si le projet existe déjà (projectContext non vide): modifie UNIQUEMENT les fichiers concernés
- Utilise du HTML5 sémantique (<header>, <nav>, <main>, <section>, <footer>)
- CSS moderne (flexbox, grid, variables CSS, animations, transitions)
- JavaScript vanilla moderne (ES6+, async/await, fetch API, DOM manipulation)
- Design responsive et mobile-first
- **IMPORTANT**: N'utilise JAMAIS de smileys/emojis dans le code HTML/CSS/JS. Utilise UNIQUEMENT des icônes SVG inline ou des bibliothèques d'icônes (Font Awesome, Lucide icons, Heroicons, etc.). Les emojis sont INTERDITS dans tout le code.
- NE JAMAIS générer de boutons flottants ou en position fixe sauf si demandé
- Code propre, fonctionnel et sans widgets inutiles
- Pas de markdown, pas de backticks, juste du JSON valide NDJSON

**FICHIERS OBLIGATOIRES - RÈGLES STRICTES**:
- **styles.css** EST OBLIGATOIRE et DOIT contenir (MINIMUM 100 lignes) :
  * Reset CSS complet (*, body, box-sizing, etc.)
  * Variables CSS personnalisées dans :root (couleurs, espacements, fonts, etc.)
  * Styles détaillés pour TOUS les éléments HTML utilisés (header, nav, sections, footer, etc.)
  * Media queries complètes pour le responsive (mobile, tablet, desktop)
  * Au moins 3-5 animations personnalisées avec @keyframes
  * Transitions et effets hover pour TOUS les éléments interactifs
  * Styles de grilles et flexbox
- **script.js** EST OBLIGATOIRE et DOIT contenir (MINIMUM 50 lignes) :
  * DOMContentLoaded event listener
  * Au moins 3-5 fonctions d'interactivité (menu, scroll, animations, formulaires, etc.)
  * Event listeners pour les interactions utilisateur
  * Logique de navigation si plusieurs pages
  * Animations JavaScript ou manipulations DOM
  * JAMAIS un fichier vide ou avec juste console.log
- **CRITIQUE**: TOUS les sites web doivent inclure du JavaScript pour l'interactivité
- Ajoute TOUJOURS au minimum : navigation mobile, animations au scroll, interactions utilisateur
- Utilise JavaScript pour : effets au survol, animations d'apparition, menus interactifs, formulaires dynamiques

ANIMATIONS ET DESIGN:
- **OBLIGATOIRE**: Tous les sites doivent avoir des animations sobres et élégantes
- Utilise CSS pour : transitions fluides (0.3s ease), animations au scroll, hover effects subtils
- Animations recommandées : fade-in au scroll, slide-in pour les éléments, scale sur les images au hover
- Utilise @keyframes pour les animations d'entrée des éléments
- Ajoute des transitions sur les liens, boutons, cartes (transform, opacity, box-shadow)
- Les animations doivent être SOBRES : pas trop rapides, pas trop lentes, élégantes et professionnelles
- Exemple d'animations CSS à inclure : 
  * Fade-in progressif pour les sections au chargement
  * Scale subtil (1.05) au hover sur les cartes/boutons
  * Transitions douces pour les changements de couleur
  * Parallax léger sur les images de fond si pertinent

EXEMPLE DE RÉPONSE POUR NOUVEAU SITE WEB:
{"type":"message","content":"Je vais créer un site web statique en HTML/CSS/JavaScript..."}
{"type":"status","content":"Task: Création de la structure HTML"}
{"type":"code_update","path":"index.html","code":"<!DOCTYPE html><html>...code complet...</html>"}
{"type":"status","content":"Task: Styles CSS"}
{"type":"code_update","path":"styles.css","code":"* { margin: 0; padding: 0; }..."}
{"type":"status","content":"Task: JavaScript"}
{"type":"code_update","path":"script.js","code":"document.addEventListener('DOMContentLoaded', () => {...})"}
{"type":"message","content":"Site web créé avec succès !"}
{"type":"complete"}` : `Tu es un expert développeur React/TypeScript qui génère et modifie du code pour des sites web.

PROJET ACTUEL:
${projectContext || 'Projet vide - première génération'}

HISTORIQUE DE CONVERSATION:
${historyContext || 'Aucun historique'}

FORMAT DE RÉPONSE OBLIGATOIRE - Tu DOIS répondre avec des événements NDJSON (une ligne = un objet JSON):

Types d'événements disponibles:
1. {"type":"message","content":"Message conversationnel pour l'utilisateur"}
2. {"type":"status","content":"Task: Titre de la tâche"} ou {"type":"status","content":"Titre: Détail de l'étape"}
3. {"type":"code_update","path":"chemin/fichier.tsx","code":"code complet du fichier"}
4. {"type":"complete"}

FLUX DE RÉPONSE OBLIGATOIRE:
1. Envoie des événements {"type":"status"} pour montrer la progression des tâches
2. Envoie des {"type":"code_update"} pour CHAQUE fichier créé/modifié avec le code COMPLET
3. Termine par UN SEUL {"type":"message","content":"Résumé concis de ce qui a été fait"}
4. **CRITIQUE**: Finis TOUJOURS par {"type":"complete"} - SANS CE EVENT LA PREVIEW NE S'AFFICHERA JAMAIS !

RÈGLES DE CODE - TRÈS IMPORTANT:
- Nouvelle app/site : Tu DOIS créer TOUS les fichiers nécessaires. Génère TOUS ces fichiers via code_update :
  1. package.json (avec react, react-dom, vite, typescript, tailwindcss, @types/react, @types/react-dom)
  2. index.html (point d'entrée avec <div id="root"></div>)
  3. src/main.tsx (point d'entrée: import ReactDOM, createRoot, render <App />)
  4. src/App.tsx (composant principal avec React Router et routes)
  5. src/index.css (styles Tailwind: @tailwind base/components/utilities)
  6. vite.config.ts (export default defineConfig avec react plugin)
  7. tsconfig.json (configuration TypeScript avec jsx: react-jsx)
  8. **MINIMUM 3 PAGES/COMPONENTS SUPPLÉMENTAIRES** (Home, About, Services, Contact ou équivalent)

**CRITIQUE - PAGES MULTIPLES**:
- Lors de la PREMIÈRE GÉNÉRATION d'une webapp, tu DOIS créer AU MINIMUM 4 pages/composants :
  * Page Home (composant principal)
  * + 3 autres pages pertinentes (ex: About, Services, Contact)
- Utilise React Router (react-router-dom) pour la navigation entre les pages
- Chaque page doit avoir du contenu réel et complet, pas des composants vides
- Configure les routes dans App.tsx avec des liens de navigation fonctionnels
  
- Si le projet existe déjà (projectContext non vide): modifie UNIQUEMENT les fichiers concernés
- Utilise React + TypeScript + Tailwind CSS
- NE JAMAIS générer de boutons de changement de thème flottants ou en position fixe
- NE JAMAIS générer de boutons scroll to top ou retour en haut
- NE PAS ajouter d éléments UI superposés sauf si explicitement demandé
- Code propre, fonctionnel et sans widgets inutiles
- **IMPORTANT**: N'utilise JAMAIS de smileys/emojis dans le code. Utilise UNIQUEMENT des icônes de lucide-react à la place. Les emojis sont INTERDITS dans tout le code.
- Pas de markdown, pas de backticks, juste du JSON valide NDJSON

INTERACTIVITÉ JAVASCRIPT/TYPESCRIPT OBLIGATOIRE:
- **CRITIQUE**: Tous les sites doivent être interactifs avec du code TypeScript/JavaScript riche
- Ajoute TOUJOURS : gestion d'état (useState, useEffect), interactions utilisateur, animations
- Utilise les hooks React pour créer des expériences dynamiques et réactives
- Les composants doivent avoir de la logique, pas seulement de l'affichage statique

ANIMATIONS ET DESIGN:
- **OBLIGATOIRE**: Tous les sites doivent avoir des animations sobres et élégantes
- Utilise Tailwind pour les transitions : transition-all duration-300 ease-in-out
- Animations recommandées : hover:scale-105, hover:shadow-lg, animate-fade-in
- Ajoute des animations personnalisées dans index.css avec @keyframes si nécessaire
- Les animations doivent être SOBRES : élégantes, fluides et professionnelles
- Exemple d'animations Tailwind à inclure :
  * hover:scale-105 sur les cartes et boutons
  * transition-transform duration-300 pour les changements fluides
  * opacity animations pour les apparitions d'éléments
  * group-hover pour des effets sophistiqués sur les containers

EXEMPLE DE RÉPONSE POUR NOUVEAU PROJET:
{"type":"status","content":"Task: Configuration du projet"}
{"type":"code_update","path":"package.json","code":"{...code complet...}"}
{"type":"code_update","path":"index.html","code":"<!DOCTYPE html>...code complet..."}
{"type":"status","content":"Task: Point d'entrée React"}
{"type":"code_update","path":"src/main.tsx","code":"import React from 'react'...code complet..."}
{"type":"code_update","path":"src/App.tsx","code":"function App() {...code complet...}"}
{"type":"code_update","path":"src/index.css","code":"@tailwind base;...code complet..."}
{"type":"code_update","path":"vite.config.ts","code":"import { defineConfig }...code complet..."}
{"type":"code_update","path":"tsconfig.json","code":"{...code complet...}"}
{"type":"message","content":"Projet créé avec succès !"}
{"type":"complete"}

IMPORTANT:
- Une ligne = un objet JSON
- Utilise des événements "status" pour montrer la progression (Task: titre, puis titre: détail)
- Renvoie le CODE COMPLET de chaque fichier avec "code_update"
- **ABSOLUMENT OBLIGATOIRE**: Termine TOUJOURS par {"type":"complete"} sinon le site ne s'affichera JAMAIS
- Pour NOUVEAU PROJET: génère TOUS les 7 fichiers minimum listés ci-dessus
- Le dernier événement doit TOUJOURS être {"type":"complete"} même si tu penses avoir fini

Exemple de flux COMPLET:
{"type":"message","content":"Je vais créer votre site web."}
{"type":"status","content":"Task: Configuration du projet"}
{"type":"code_update","path":"package.json","code":"..."}
{"type":"status","content":"Task: Création des composants"}
{"type":"code_update","path":"src/App.tsx","code":"..."}
{"type":"message","content":"Site créé avec succès!"}
{"type":"complete"}
{"type":"status","content":"Task: Setting up project structure"}
{"type":"status","content":"Setting up project structure: Creating main App component"}
{"type":"code_update","path":"src/App.tsx","code":"import React from 'react'..."}
{"type":"status","content":"Task: Styling components"}
{"type":"status","content":"Styling components: Applying Tailwind CSS"}
{"type":"message","content":"Le site est créé et prêt."}
{"type":"complete"}`;

    // Créer un stream de réponse
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          console.log('📤 Envoi à Claude Sonnet 4.5...');

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY!,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: 16384,
              stream: true,
              system: systemPrompt,
              messages: [
                ...recentHistory,
                { role: 'user', content: message }
              ],
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            console.error('❌ Erreur Claude:', error);
            throw new Error(`Claude API error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No stream reader');

          const decoder = new TextDecoder();
          let buffer = ''; // Buffer pour les événements NDJSON de Claude
          let sseBuffer = ''; // Buffer pour les lignes SSE incomplètes
          let hasComplete = false;
          const generatedFiles = new Map<string, string>(); // Tracker des fichiers générés

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            sseBuffer += chunk;
            
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || ''; // Garder la dernière ligne incomplète

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const event = JSON.parse(data);
                
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  buffer += event.delta.text;
                  
                  // Parser les événements NDJSON complets du buffer
                  const eventLines = buffer.split('\n');
                  
                  for (let i = 0; i < eventLines.length - 1; i++) {
                    const eventLine = eventLines[i].trim();
                    if (!eventLine) continue;
                    
                    try {
                      const aiEvent = JSON.parse(eventLine);
                      if (aiEvent.type === 'complete') hasComplete = true;
                      if (aiEvent.type === 'code_update' && aiEvent.path && aiEvent.code) {
                        generatedFiles.set(aiEvent.path, aiEvent.code);
                      }
                      const eventData = `data: ${JSON.stringify(aiEvent)}\n\n`;
                      controller.enqueue(encoder.encode(eventData));
                      console.log('✅ Événement envoyé:', aiEvent.type);
                    } catch (e) {
                      // JSON incomplet, on attend plus de données
                      console.log('⏳ JSON incomplet, attente:', eventLine.substring(0, 50));
                    }
                  }
                  
                  // Garder la dernière ligne (potentiellement incomplète)
                  buffer = eventLines[eventLines.length - 1];
                }
              } catch (e) {
                console.error('⚠️ Erreur parsing SSE:', e);
              }
            }
          }

          // Parser le buffer SSE restant
          if (sseBuffer.trim()) {
            const lines = sseBuffer.split('\n');
            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;
              
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const event = JSON.parse(data);
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  buffer += event.delta.text;
                }
              } catch (e) {
                console.error('⚠️ Erreur parsing SSE final:', e);
              }
            }
          }

          // Parser le buffer NDJSON final
          if (buffer.trim()) {
            const eventLines = buffer.split('\n');
            for (const eventLine of eventLines) {
              if (!eventLine.trim()) continue;
              try {
                const aiEvent = JSON.parse(eventLine);
                if (aiEvent.type === 'complete') hasComplete = true;
                if (aiEvent.type === 'code_update' && aiEvent.path && aiEvent.code) {
                  generatedFiles.set(aiEvent.path, aiEvent.code);
                }
                const eventData = `data: ${JSON.stringify(aiEvent)}\n\n`;
                controller.enqueue(encoder.encode(eventData));
                console.log('✅ Événement final envoyé:', aiEvent.type);
              } catch (e) {
                console.log('⚠️ JSON invalide dans buffer final:', eventLine.substring(0, 100));
              }
            }
          }

          // VALIDATION POST-GÉNÉRATION : Vérifier les 3 fichiers obligatoires
          if (isWebsite && generatedFiles.size > 0) {
            console.log('📋 Fichiers générés:', Array.from(generatedFiles.keys()));
            
            const hasHTML = generatedFiles.has('index.html');
            const hasCSS = generatedFiles.has('styles.css');
            const hasJS = generatedFiles.has('script.js');
            
            if (!hasCSS || !hasJS) {
              console.log('❌ ERREUR CRITIQUE: Fichiers CSS/JS manquants!');
              
              // Essayer d'extraire CSS/JS inline du HTML si présent
              const htmlContent = generatedFiles.get('index.html') || '';
              
              // Extraire CSS inline UNIQUEMENT si présent
              if (!hasCSS) {
                const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
                if (styleMatch && styleMatch[1].trim().length > 100) {
                  const extractedCSS = styleMatch[1].trim();
                  generatedFiles.set('styles.css', extractedCSS);
                  const cssEvent = { type: 'code_update', path: 'styles.css', code: extractedCSS };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(cssEvent)}\n\n`));
                  console.log(`✅ CSS extrait du HTML inline (${extractedCSS.length} caractères)`);
                } else {
                  // ERREUR: Pas de CSS généré et rien à extraire
                  const errorEvent = { 
                    type: 'error', 
                    message: 'Le fichier styles.css n\'a pas été généré. Veuillez réessayer.' 
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                  console.error('❌ Aucun CSS généré par Claude!');
                }
              }
              
              // Extraire JS inline UNIQUEMENT si présent
              if (!hasJS) {
                const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
                if (scriptMatch && scriptMatch[1].trim() && !scriptMatch[0].includes('src=') && scriptMatch[1].trim().length > 50) {
                  const extractedJS = scriptMatch[1].trim();
                  generatedFiles.set('script.js', extractedJS);
                  const jsEvent = { type: 'code_update', path: 'script.js', code: extractedJS };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(jsEvent)}\n\n`));
                  console.log(`✅ JS extrait du HTML inline (${extractedJS.length} caractères)`);
                } else {
                  // ERREUR: Pas de JS généré et rien à extraire
                  const errorEvent = { 
                    type: 'error', 
                    message: 'Le fichier script.js n\'a pas été généré. Veuillez réessayer.' 
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                  console.error('❌ Aucun JS généré par Claude!');
                }
              }
            }
            
            console.log('✅ Validation complète - Fichiers finaux:', Array.from(generatedFiles.keys()));
          }

          // S'assurer qu'un événement complete est TOUJOURS envoyé
          if (!hasComplete) {
            const completeEvent = { type: 'complete' };
            const completeData = `data: ${JSON.stringify(completeEvent)}\n\n`;
            controller.enqueue(encoder.encode(completeData));
            console.log('🏁 Événement complete forcé envoyé');
          } else {
            console.log('✅ Événement complete déjà reçu');
          }

          controller.close();
          
        } catch (error) {
          console.error('❌ Erreur dans le stream:', error);
          const errorEvent = { 
            type: 'status', 
            content: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
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
    console.error('❌ Erreur agent API:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
