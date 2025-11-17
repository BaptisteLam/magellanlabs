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
1. Commence par un {"type":"message","content":"Message naturel expliquant ce que tu vas faire"}
2. Envoie des événements {"type":"status"} pour montrer la progression des tâches
3. Envoie des {"type":"code_update"} pour CHAQUE fichier créé/modifié avec le code COMPLET
4. Termine par {"type":"message","content":"Résumé de ce qui a été fait"}
5. **CRITIQUE**: Finis TOUJOURS par {"type":"complete"} - SANS CE EVENT LA PREVIEW NE S'AFFICHERA JAMAIS !

RÈGLES DE CODE - TRÈS IMPORTANT ET NON NÉGOCIABLE:
- Tu DOIS générer UNIQUEMENT du HTML, CSS et JavaScript vanilla pur
- **OBLIGATOIRE**: Tu DOIS TOUJOURS créer/modifier CES 3 TYPES DE FICHIERS : HTML, CSS ET JavaScript
- **INTERDICTION ABSOLUE**: NE JAMAIS générer uniquement du HTML sans CSS et JS
- NE JAMAIS utiliser React, JSX, TypeScript ou tout autre framework
- NE JAMAIS créer de package.json, tsconfig.json ou vite.config.ts
- Nouveau site web: Tu DOIS IMPÉRATIVEMENT créer ces 3 fichiers simples via code_update:
  1. **index.html** (structure HTML complète avec <!DOCTYPE html>)
  2. **styles.css** (OBLIGATOIRE - tous les styles CSS avec animations, transitions, responsive, etc. - JAMAIS VIDE)
  3. **script.js** (OBLIGATOIRE - logique JavaScript vanilla pour interactivité - JAMAIS VIDE)
  4. **MINIMUM 3 PAGES SUPPLÉMENTAIRES** (about.html, services.html, contact.html ou équivalent selon le contexte)
  5. Autres fichiers .html si nécessaire (pages supplémentaires)

**CRITIQUE - PAGES MULTIPLES**:
- Lors de la PREMIÈRE GÉNÉRATION d'un site web, tu DOIS créer AU MINIMUM 4 pages HTML :
  * index.html (page d'accueil)
  * + 3 autres pages pertinentes (ex: about.html, services.html, contact.html)
- Chaque page doit avoir du contenu réel et complet, pas des pages vides
- Ajoute une navigation cohérente entre toutes les pages
- Les pages supplémentaires doivent être liées depuis la navigation de index.html

IMAGES ET RESSOURCES:
- Tu peux télécharger et utiliser des images libres de droit depuis Unsplash, Pexels, etc.
- Intègre intelligemment des images pertinentes au contenu du site
- Utilise des URLs d'images directes dans les balises <img> ou en background CSS
- Optimise le chargement avec lazy loading quand approprié

QUALITÉ DU CODE:
- Si le projet existe déjà (projectContext non vide): modifie UNIQUEMENT les fichiers concernés
- Utilise du HTML5 sémantique (<header>, <nav>, <main>, <section>, <footer>)
- CSS moderne (flexbox, grid, variables CSS, animations, transitions)
- JavaScript vanilla moderne (ES6+, async/await, fetch API, DOM manipulation)
- Design responsive et mobile-first
- **IMPORTANT**: N'utilise JAMAIS de smileys/emojis dans le code HTML/CSS/JS. Utilise toujours des icônes SVG ou des bibliothèques d'icônes (Font Awesome, Lucide, etc.)
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
1. Commence par un {"type":"message","content":"Message naturel expliquant ce que tu vas faire"}
2. Envoie des événements {"type":"status"} pour montrer la progression des tâches
3. Envoie des {"type":"code_update"} pour CHAQUE fichier créé/modifié avec le code COMPLET
4. Termine par {"type":"message","content":"Résumé de ce qui a été fait"}
5. **CRITIQUE**: Finis TOUJOURS par {"type":"complete"} - SANS CE EVENT LA PREVIEW NE S'AFFICHERA JAMAIS !

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
- **IMPORTANT**: N'utilise JAMAIS de smileys/emojis dans le code. Utilise toujours des icônes de lucide-react à la place
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
{"type":"message","content":"Je vais créer une application React complète..."}
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
- Commence toujours par un message conversationnel
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
                const eventData = `data: ${JSON.stringify(aiEvent)}\n\n`;
                controller.enqueue(encoder.encode(eventData));
                console.log('✅ Événement final envoyé:', aiEvent.type);
              } catch (e) {
                console.log('⚠️ JSON invalide dans buffer final:', eventLine.substring(0, 100));
              }
            }
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
