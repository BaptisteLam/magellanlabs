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

// Parser pour extraire les fichiers au format // FILE: path
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Format 1: // FILE: path suivi du contenu (avec ou sans code blocks)
  const fileRegex = /\/\/\s*FILE:\s*(.+?)(?:\n|$)/g;
  const matches = [...code.matchAll(fileRegex)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filePath = match[1].trim();
    const startIndex = match.index! + match[0].length;
    
    // Trouve le contenu jusqu'au prochain fichier
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : code.length;
    let rawContent = code.slice(startIndex, endIndex).trim();
    
    // Nettoyer les code blocks markdown si présents
    // Exemples: ```json ... ```, ```typescript ... ```, etc.
    const codeBlockMatch = rawContent.match(/^```[\w]*\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      rawContent = codeBlockMatch[1].trim();
    }
    
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
      const extension = path.split('.').pop() || '';
      
      files.push({
        path: path.trim(),
        content: content.trim(),
        type: getFileType(extension)
      });
    }
  }
  
  // Format 3: HTML standalone - REJETER si pas de CSS et JS
  if (files.length === 0 && (code.includes('<!DOCTYPE html>') || code.includes('<html'))) {
    console.error('❌ ERREUR: Génération HTML uniquement détectée - CSS et JS requis!');
    throw new Error('La génération doit OBLIGATOIREMENT inclure HTML, CSS ET JavaScript. Impossible de créer uniquement du HTML.');
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

// Détecte la structure du projet
function detectProjectStructure(files: ProjectFile[]): string {
  const paths = files.map(f => f.path);
  
  if (paths.some(p => p.includes('package.json'))) {
    if (paths.some(p => p.includes('next.config'))) return 'nextjs';
    if (paths.some(p => p.includes('vite.config'))) return 'react';
    if (paths.some(p => p.includes('vue.config'))) return 'vue';
    return 'react';
  }
  
  return 'html';
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

    // Prompt système REACT UNIQUEMENT - Génère toujours des projets React/Vite avec TypeScript
    const systemPrompt = `Tu es un expert développeur React/TypeScript spécialisé dans la création de projets web React modernes, visuellement impressionnants et professionnels.

🎯 ARCHITECTURE OBLIGATOIRE : REACT/VITE + TYPESCRIPT
Tu DOIS TOUJOURS générer des projets React avec Vite et TypeScript. PAS de HTML/CSS/JS vanilla.

STRUCTURE OBLIGATOIRE POUR TOUS LES PROJETS :

// FILE: package.json
{
  "name": "projet-moderne",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}

// FILE: vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})

// FILE: tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}

// FILE: tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}

// FILE: index.html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Projet Moderne</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

// FILE: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// FILE: src/App.tsx
[Composant principal avec PLUSIEURS sections complètes - minimum 150+ lignes de JSX]
[Utilise useState, useEffect et autres hooks React pour l'interactivité]
[Plusieurs composants bien structurés]

// FILE: src/index.css
[Styles CSS modernes : variables CSS, gradients, animations, responsive - minimum 80+ lignes]

🔥 FORMULAIRE DE CONTACT OBLIGATOIRE EN REACT :
Pour CHAQUE projet généré, tu DOIS inclure un composant de formulaire de contact fonctionnel :

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
        setMessage('✅ Message envoyé avec succès !')
        setFormData({ name: '', email: '', phone: '', message: '' })
      } else {
        throw new Error('Erreur serveur')
      }
    } catch (error) {
      setStatus('error')
      setMessage('❌ Erreur lors de l\\'envoi. Réessayez.')
    }
  }

  return (
    <section className="contact-section">
      <h2>Contactez-nous</h2>
      <form onSubmit={handleSubmit} className="contact-form">
        <input
          type="text"
          placeholder="Votre nom"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          type="email"
          placeholder="Votre email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <input
          type="tel"
          placeholder="Téléphone (optionnel)"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <textarea
          placeholder="Votre message"
          required
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        />
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Envoi...' : 'Envoyer'}
        </button>
      </form>
      {message && <div className={\`form-message \${status}\`}>{message}</div>}
    </section>
  )
}

RÈGLES DE GÉNÉRATION :
1. **TOUJOURS REACT** : Génère UNIQUEMENT des projets React/Vite avec TypeScript - JAMAIS de HTML/CSS/JS vanilla
2. **CONTENU COMPLET** : Minimum 150+ lignes de JSX dans App.tsx avec plusieurs sections
3. **COMPOSANTS RÉUTILISABLES** : Crée au moins 3-4 composants dans src/components/
4. **HOOKS REACT** : Utilise useState, useEffect, et autres hooks pour l'interactivité
5. **TYPESCRIPT** : Tous les fichiers .tsx avec types appropriés
6. **DESIGN MODERNE** : Animations CSS, gradients, responsive, palette de couleurs harmonieuse

FORMAT DE SORTIE (OBLIGATOIRE) :
Chaque fichier DOIT être précédé de :
// FILE: chemin/complet/fichier.extension

STRUCTURE MINIMALE REQUISE :
✅ package.json (avec React + Vite + TypeScript)
✅ vite.config.ts
✅ tsconfig.json
✅ tsconfig.node.json
✅ index.html (avec <div id="root">)
✅ src/main.tsx (point d'entrée React)
✅ src/App.tsx (composant principal riche - 150+ lignes)
✅ src/index.css (styles modernes - 80+ lignes)
✅ src/components/ContactForm.tsx (formulaire de contact)
✅ src/components/[Autres].tsx (au moins 2-3 composants supplémentaires)

EXIGENCES DE QUALITÉ :
✅ Design moderne avec gradients, ombres, animations CSS
✅ Responsive mobile-first (breakpoints tablet et desktop)
✅ Typographie élégante avec hiérarchie claire
✅ Palette de couleurs harmonieuse (3-5 couleurs)
✅ Contenu textuel réaliste et substantiel
✅ Interactivité riche avec React hooks (useState, useEffect, etc.)
✅ Composants bien organisés et réutilisables
✅ Types TypeScript appropriés

❌ INTERDIT :
- Générer du HTML/CSS/JS vanilla
- Projets avec moins de 150 lignes de JSX
- "Hello World" ou contenu minimaliste
- Design basique sans style
- Absence de composants
- Pas de types TypeScript

Génère maintenant un projet React/Vite complet, professionnel et visuellement impressionnant avec TypeScript.`;

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
      
      // Return generic error message to user
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

    // Stream SSE avec parsing en temps réel et events structurés
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let streamClosed = false; // Flag pour éviter d'enqueuer après fermeture

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

        // Event: start avec phase d'analyse
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          data: { sessionId, phase: 'analyzing' }
        })}\n\n`));

        // Event: Analyse du prompt
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
        
        // Variables pour capturer les tokens réels de Claude
        let inputTokens = 0;
        let outputTokens = 0;

        // Timeout de 120 secondes (2 minutes)
        timeout = setTimeout(() => {
          console.error('[generate-site] Timeout après 120s');
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: { message: 'Timeout: La génération a pris trop de temps. Veuillez réessayer avec une demande plus simple.' }
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
              
              // Claude SSE format: "event: content_block_delta" suivi de "data: {...}"
              if (line.startsWith('event:')) {
                continue; // Skip event type lines
              }
              
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              
              try {
                const parsed = JSON.parse(dataStr);
                
                // Capturer les tokens depuis message_start
                if (parsed.type === 'message_start' && parsed.message?.usage) {
                  inputTokens = parsed.message.usage.input_tokens || 0;
                  console.log(`[generate-site] 📊 Input tokens: ${inputTokens}`);

                  // Event: Analyse terminée, début de génération
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
                      message: 'Planification de l\'architecture',
                      status: 'in-progress',
                      phase: 'planning'
                    }
                  })}\n\n`));
                }
                
                // Capturer les tokens d'output depuis message_delta
                if (parsed.type === 'message_delta' && parsed.usage) {
                  outputTokens = parsed.usage.output_tokens || 0;
                  console.log(`[generate-site] 📊 Output tokens so far: ${outputTokens}`);
                }
              } catch (e) {
                // Ignore parsing errors for non-JSON lines
              }
              
              // Claude envoie un [DONE] ou message_stop
              if (dataStr === '[DONE]' || dataStr.includes('"type":"message_stop"')) {
                if (timeout) clearTimeout(timeout);
                
                // ✅ VALIDATION DU CONTENU FINAL
                console.log(`[generate-site] 📏 Final accumulated content: ${accumulated.length} characters`);
                
                if (!accumulated || accumulated.trim().length === 0) {
                  console.error("[generate-site] ❌ ERROR: Accumulated content is empty!");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Le contenu généré est vide — génération échouée' }
                  })}\n\n`));
                  closeStream();
                  return;
                }

                if (accumulated.length < 100) {
                  console.error(`[generate-site] ❌ ERROR: Content too short (${accumulated.length} chars)`);
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: `Contenu trop court (${accumulated.length} caractères) — génération échouée` }
                  })}\n\n`));
                  closeStream();
                  return;
                }

                console.log(`[generate-site] 🧠 Content preview (first 200 chars): ${accumulated.substring(0, 200)}...`);
                
                // Parsing final et sauvegarde
                const finalFiles = parseGeneratedCode(accumulated);
                const projectType = detectProjectStructure(finalFiles);
                
                console.log(`[generate-site] 📦 Parsed ${finalFiles.length} files, type: ${projectType}`);
                
                // ✅ VALIDATION STRICTE DU HTML
                const htmlFile = finalFiles.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'));
                if (htmlFile) {
                  const htmlContent = htmlFile.content;
                  console.log(`[generate-site] 📄 index.html size: ${htmlContent.length} characters`);
                  console.log(`[generate-site] 🧠 HTML preview (first 200 chars): ${htmlContent.substring(0, 200)}...`);
                  
                  if (htmlContent.length < 50) {
                    console.error(`[generate-site] ❌ ERROR: index.html too short (${htmlContent.length} chars)`);
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      data: { message: `HTML trop court (${htmlContent.length} caractères) — génération échouée` }
                    })}\n\n`));
                    closeStream();
                    return;
                  }

                  // Vérifier les balises essentielles
                  const hasHtml = htmlContent.includes('<html');
                  const hasHead = htmlContent.includes('<head');
                  const hasBody = htmlContent.includes('<body');
                  
                  console.log(`[generate-site] 🔍 HTML validation: <html>=${hasHtml}, <head>=${hasHead}, <body>=${hasBody}`);
                  
                  if (!hasHtml || !hasHead || !hasBody) {
                    console.error("[generate-site] ❌ ERROR: Missing essential HTML tags");
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      data: { message: 'HTML invalide - balises essentielles manquantes (<html>, <head>, ou <body>)' }
                    })}\n\n`));
                    closeStream();
                    return;
                  }

                  console.log(`[generate-site] ✅ index.html validated successfully (${htmlContent.length} chars)`);
                } else {
                  console.error("[generate-site] ❌ ERROR: No index.html file found in parsed files");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Aucun fichier index.html trouvé — génération échouée' }
                  })}\n\n`));
                  closeStream();
                  return;
                }
                
                const totalTokens = inputTokens + outputTokens;
                console.log(`[generate-site] 📊 FINAL TOKEN COUNT: Input=${inputTokens}, Output=${outputTokens}, Total=${totalTokens}`);

                // Event: Planification terminée
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'generation_event',
                  data: {
                    type: 'complete',
                    message: 'Planification terminée',
                    status: 'completed',
                    phase: 'planning'
                  }
                })}\n\n`));

                // Event: Validation en cours
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'generation_event',
                  data: {
                    type: 'analyze',
                    message: 'Vérification et optimisation',
                    status: 'in-progress',
                    phase: 'validation'
                  }
                })}\n\n`));

                // Sauvegarder dans Supabase
                if (sessionId) {
                  await supabaseClient
                    .from('build_sessions')
                    .update({
                      project_files: finalFiles,
                      project_type: projectType,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', sessionId);
                }

                // Event: Validation terminée
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'generation_event',
                  data: {
                    type: 'complete',
                    message: 'Validation terminée',
                    status: 'completed',
                    phase: 'validation'
                  }
                })}\n\n`));

                // Event: complete avec tokens réels
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: {
                    totalFiles: finalFiles.length,
                    projectType,
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
                
                // Support Claude streaming format: { type: "content_block_delta", delta: { text: "..." } }
                // ET OpenAI format: { choices: [{ delta: { content: "..." } }] }
                const delta = json?.delta?.text || json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;
                
                // Event: chunk (streaming progressif)
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk',
                  data: { content: delta }
                })}\n\n`));

                // Parser optimisé: seulement tous les 500 caractères
                if (accumulated.length % 500 < delta.length) {
                  const currentFiles = parseGeneratedCode(accumulated);

                  // Détecte les nouveaux fichiers
                  if (currentFiles.length > lastParsedFiles.length) {
                    const newFiles = currentFiles.slice(lastParsedFiles.length);

                    for (const file of newFiles) {
                      // Générer un message contextuel basé sur le type de fichier
                      let eventType = 'create';
                      let message = '';

                      if (file.path.includes('App.tsx') || file.path.includes('main.tsx')) {
                        eventType = 'write';
                        message = 'Création du composant principal';
                      } else if (file.path.includes('component') || file.path.includes('Component')) {
                        eventType = 'write';
                        const componentName = file.path.split('/').pop()?.replace('.tsx', '').replace('.jsx', '');
                        message = `Création du composant ${componentName}`;
                      } else if (file.path.includes('.css') || file.path.includes('style')) {
                        eventType = 'write';
                        message = 'Mise en place des styles';
                      } else if (file.path === 'package.json') {
                        eventType = 'create';
                        message = 'Configuration des dépendances';
                      } else if (file.path === 'index.html') {
                        eventType = 'create';
                        message = 'Création de la structure HTML';
                      } else if (file.path.includes('vite.config') || file.path.includes('tsconfig')) {
                        eventType = 'create';
                        message = 'Configuration du projet';
                      } else if (file.path.includes('Chart') || file.path.includes('Graph')) {
                        eventType = 'write';
                        message = 'Création des graphiques';
                      } else if (file.path.includes('Menu') || file.path.includes('Nav')) {
                        eventType = 'write';
                        message = 'Mise en place du menu de navigation';
                      } else if (file.path.includes('Form') || file.path.includes('Contact')) {
                        eventType = 'write';
                        message = 'Création du formulaire';
                      } else if (file.path.includes('Hero') || file.path.includes('Header')) {
                        eventType = 'write';
                        message = 'Création de la section hero';
                      } else if (file.path.includes('Footer')) {
                        eventType = 'write';
                        message = 'Création du footer';
                      } else {
                        eventType = 'create';
                        const fileName = file.path.split('/').pop();
                        message = `Création de ${fileName}`;
                      }

                      // Event: file_detected avec message contextuel
                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'file_detected',
                        data: { path: file.path, content: file.content, type: file.type }
                      })}\n\n`));

                      // Event: generation_event pour l'affichage user-friendly
                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'generation_event',
                        data: {
                          type: eventType,
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
          
          // Si on sort de la boucle sans avoir reçu [DONE]
          if (!streamClosed) {
            if (timeout) clearTimeout(timeout);
            closeStream();
          }
        } catch (error) {
          if (timeout) clearTimeout(timeout);
          console.error('[generate-site] Stream error:', error);
          
          // Event: error
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
