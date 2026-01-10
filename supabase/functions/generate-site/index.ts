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
  
  // Supprimer les code blocks au début (```tsx, ```html, ```css, ```json, etc.)
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/gm, '');
  
  // Supprimer les code blocks à la fin (```)
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Supprimer les marqueurs résiduels au milieu du contenu
  cleaned = cleaned.replace(/^```\s*$/gm, '');
  
  // Nettoyer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

// Normalise les chemins de fichiers pour Sandpack - FORCE /src/ pour TOUS les fichiers source
function normalizePath(path: string): string {
  let normalized = path.trim();
  
  // Ajouter / au début si absent
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Ne pas modifier les fichiers de config à la racine
  const rootFiles = ['/package.json', '/vite.config.ts', '/tsconfig.json', '/tsconfig.node.json', '/index.html'];
  if (rootFiles.includes(normalized)) {
    return normalized;
  }
  
  // 🔧 FIX: Forcer TOUS les fichiers source vers /src/
  const isSourceFile = normalized.match(/\.(tsx?|jsx?|css)$/);
  if (isSourceFile && !normalized.startsWith('/src/')) {
    // Supprimer le / initial pour reconstruire le chemin
    const cleanPath = normalized.replace(/^\/+/, '');
    
    // Si déjà préfixé src/, ne pas doubler
    if (cleanPath.startsWith('src/')) {
      normalized = '/' + cleanPath;
    } else if (cleanPath.match(/^(components|hooks|utils|lib|services|pages|styles)\//)) {
      // Si c'est un dossier connu, ajouter /src/ devant
      normalized = '/src/' + cleanPath;
    } else {
      // TOUS les autres fichiers source vont dans /src/
      normalized = '/src/' + cleanPath;
    }
  }
  
  console.log(`[normalizePath] ${path} -> ${normalized}`);
  return normalized;
}

// Parser pour extraire les fichiers - supporte plusieurs formats de sortie Claude
function parseGeneratedCode(code: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Log pour debug
  console.log('[parseGeneratedCode] Input length:', code.length);
  console.log('[parseGeneratedCode] First 300 chars:', code.substring(0, 300));
  
  // Nettoyer les wrappers markdown globaux si présents
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
      
      // Trouve le contenu jusqu'au prochain fichier
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
      let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
      
      // Nettoyer les code blocks markdown si présents
      const codeBlockMatch = rawContent.match(/^```[\w]*\n([\s\S]*?)```$/);
      if (codeBlockMatch) {
        rawContent = codeBlockMatch[1].trim();
      } else {
        rawContent = cleanFileContent(rawContent);
      }
      
      // Normaliser le chemin
      filePath = normalizePath(filePath);
      
      const extension = filePath.split('.').pop() || '';
      
      files.push({
        path: filePath,
        content: rawContent,
        type: getFileType(extension)
      });
    }
  }
  
  // Format 2: --- FILE: path --- (format alternatif)
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
  
  // Format 3: code blocks avec nom de fichier (```tsx:src/App.tsx)
  if (files.length === 0) {
    const codeBlockRegex = /```(?:[\w]+)?:?([\w/.-]+\.(?:tsx?|jsx?|css))\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(cleanedCode)) !== null) {
      const [, path, content] = match;
      const normalizedPath = normalizePath(path.trim());
      const extension = normalizedPath.split('.').pop() || '';
      
      console.log(`[parseGeneratedCode] Found file in code block: ${normalizedPath}`);
      
      files.push({
        path: normalizedPath,
        content: cleanFileContent(content),
        type: getFileType(extension)
      });
    }
  }
  
  // Format 4: ### src/path.tsx (format header markdown)
  if (files.length === 0) {
    const headerRegex = /###\s+((?:src\/)?[\w/.-]+\.(?:tsx?|jsx?|css))\s*\n/g;
    const headerMatches = [...cleanedCode.matchAll(headerRegex)];
    
    if (headerMatches.length > 0) {
      console.log(`[parseGeneratedCode] Found ${headerMatches.length} files with ### format`);
      
      for (let i = 0; i < headerMatches.length; i++) {
        const match = headerMatches[i];
        let filePath = match[1].trim();
        const startIndex = match.index! + match[0].length;
        
        const nextMatch = headerMatches[i + 1];
        const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
        let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
        
        // Extraire le contenu du code block si présent
        const codeBlockMatch = rawContent.match(/```[\w]*\n([\s\S]*?)```/);
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
  }
  
  // Format 5: **src/path.tsx** (markdown bold)
  if (files.length === 0) {
    const boldRegex = /\*\*\s*((?:src\/)?[\w/.-]+\.(?:tsx?|jsx?|css))\s*\*\*/g;
    const boldMatches = [...cleanedCode.matchAll(boldRegex)];
    
    if (boldMatches.length > 0) {
      console.log(`[parseGeneratedCode] Found ${boldMatches.length} files with **bold** format`);
      
      for (let i = 0; i < boldMatches.length; i++) {
        const match = boldMatches[i];
        let filePath = match[1].trim();
        const startIndex = match.index! + match[0].length;
        
        const nextMatch = boldMatches[i + 1];
        const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
        let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
        
        const codeBlockMatch = rawContent.match(/```[\w]*\n([\s\S]*?)```/);
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
  }
  
  // Format 6: ## File: src/path.tsx ou ## src/path.tsx (H2 header)
  if (files.length === 0) {
    const h2Regex = /##\s*(?:File:\s*)?((?:src\/)?[\w/.-]+\.(?:tsx?|jsx?|css))\s*\n/g;
    const h2Matches = [...cleanedCode.matchAll(h2Regex)];
    
    if (h2Matches.length > 0) {
      console.log(`[parseGeneratedCode] Found ${h2Matches.length} files with ## H2 format`);
      
      for (let i = 0; i < h2Matches.length; i++) {
        const match = h2Matches[i];
        let filePath = match[1].trim();
        const startIndex = match.index! + match[0].length;
        
        const nextMatch = h2Matches[i + 1];
        const endIndex = nextMatch ? nextMatch.index! : cleanedCode.length;
        let rawContent = cleanedCode.slice(startIndex, endIndex).trim();
        
        const codeBlockMatch = rawContent.match(/```[\w]*\n([\s\S]*?)```/);
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
  }
  
  // Log final
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

    // PROMPT SYSTÈME OPTIMISÉ POUR SANDPACK - Sites professionnels et beaux
    const systemPrompt = `Tu es un expert React/TypeScript spécialisé dans la création de sites web PROFESSIONNELS et VISUELLEMENT MAGNIFIQUES.

🎯 OBJECTIF: Créer un site moderne, élégant, avec un design de qualité professionnelle.

📁 FICHIERS À GÉNÉRER (format OBLIGATOIRE):

// FILE: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// FILE: src/App.tsx
[Composant principal COMPLET avec toutes les sections - minimum 150 lignes]

// FILE: src/index.css
[CSS personnalisé pour les éléments spécifiques - pas de directives @tailwind]

// FILE: src/components/[NomComposant].tsx
[Un fichier par composant utilisé]

🎨 RÈGLES DE DESIGN OBLIGATOIRES:

1. COULEURS: Utilise la palette suivante
   - Primaire: #03A5C0 (cyan professionnel)
   - Secondaire: #1a1a2e (bleu nuit)
   - Texte: #1f2937 (gris foncé)
   - Fond: #ffffff, #f9fafb (blancs)

2. TYPOGRAPHIE: 
   - Titres: text-4xl à text-6xl, font-bold
   - Sous-titres: text-xl à text-2xl, font-semibold
   - Corps: text-base, text-gray-600

3. ESPACEMENTS GÉNÉREUX:
   - Sections: py-16 ou py-20
   - Entre éléments: gap-8, gap-12
   - Padding: p-6, p-8

4. EFFETS VISUELS:
   - Ombres douces: shadow-lg, shadow-xl
   - Coins arrondis: rounded-xl, rounded-2xl
   - Transitions: transition-all duration-300
   - Hover effects: hover:shadow-xl hover:-translate-y-1

⚠️ INTERDICTIONS ABSOLUES:
- ❌ JAMAIS d'emojis ou de smileys (🏨 ❌)
- ❌ JAMAIS de symboles emoji dans le texte
- ✅ Utilise UNIQUEMENT lucide-react pour les icônes:
  import { Hotel, Star, Phone, Mail, MapPin, Calendar, Users, Check, ArrowRight, Menu, X } from 'lucide-react'

📷 IMAGES OBLIGATOIRES (URLs Unsplash valides):
- Hero: https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&h=1080&fit=crop
- Hôtel: https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop
- Bureau: https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop
- Nature: https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop
- Tech: https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop
- Équipe: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop

🔧 EXEMPLE DE COMPOSANT HEADER PROFESSIONNEL:

import { Menu, X, Phone } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="text-2xl font-bold text-gray-900">Logo</div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-gray-600 hover:text-[#03A5C0] transition-colors">Accueil</a>
            <a href="#" className="text-gray-600 hover:text-[#03A5C0] transition-colors">Services</a>
            <a href="#" className="text-gray-600 hover:text-[#03A5C0] transition-colors">Contact</a>
            <button className="bg-[#03A5C0] text-white px-6 py-2 rounded-full hover:bg-[#028a9e] transition-colors flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Appeler
            </button>
          </nav>
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </header>
  )
}

🔥 FORMULAIRE DE CONTACT FONCTIONNEL:

// FILE: src/components/ContactForm.tsx
import { useState, FormEvent } from 'react'
import { Send, Check, AlertCircle } from 'lucide-react'

export default function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

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
        setFormData({ name: '', email: '', phone: '', message: '' })
      } else {
        throw new Error('Erreur serveur')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">Contactez-nous</h2>
        <p className="text-center text-gray-600 mb-12">Nous vous répondrons dans les plus brefs délais</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <input 
              type="text" 
              placeholder="Votre nom" 
              required 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#03A5C0] focus:border-transparent outline-none transition-all"
            />
            <input 
              type="email" 
              placeholder="Votre email" 
              required 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#03A5C0] focus:border-transparent outline-none transition-all"
            />
          </div>
          <input 
            type="tel" 
            placeholder="Téléphone (optionnel)" 
            value={formData.phone} 
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#03A5C0] focus:border-transparent outline-none transition-all"
          />
          <textarea 
            placeholder="Votre message" 
            required 
            rows={5}
            value={formData.message} 
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#03A5C0] focus:border-transparent outline-none transition-all resize-none"
          />
          <button 
            type="submit" 
            disabled={status === 'loading'}
            className="w-full bg-[#03A5C0] text-white py-4 rounded-xl font-semibold hover:bg-[#028a9e] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {status === 'loading' ? 'Envoi en cours...' : (
              <>Envoyer <Send className="w-5 h-5" /></>
            )}
          </button>
        </form>
        
        {status === 'success' && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
            <Check className="w-5 h-5" />
            Message envoyé avec succès !
          </div>
        )}
        {status === 'error' && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            Erreur lors de l'envoi. Réessayez.
          </div>
        )}
      </div>
    </section>
  )
}

❌ NE PAS GÉNÉRER (Sandpack les gère):
- package.json
- vite.config.ts  
- tsconfig.json
- index.html

✅ UTILISE TAILWIND CSS:
- Classes Tailwind pour TOUT le styling
- Responsive: sm:, md:, lg:
- Hover: hover:
- Focus: focus:

FORMAT DE SORTIE STRICT:
// FILE: src/chemin/fichier.tsx
[contenu complet du fichier]

// FILE: src/chemin/autre.tsx
[contenu complet]

Génère maintenant un site web MAGNIFIQUE, PROFESSIONNEL et COMPLET.`;

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

    // Stream SSE avec parsing en temps réel
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

        // Event: start
        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          data: { sessionId, phase: 'analyzing' }
        })}\n\n`));

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
                      message: 'Génération du code React',
                      status: 'in-progress',
                      phase: 'generation'
                    }
                  })}\n\n`));
                }
                
                if (parsed.type === 'message_delta' && parsed.usage) {
                  outputTokens = parsed.usage.output_tokens || 0;
                }
              } catch (e) {
                // Ignore
              }
              
              // Claude envoie un [DONE] ou message_stop
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

                // Parsing final
                const finalFiles = parseGeneratedCode(accumulated);
                
                console.log(`[generate-site] Parsed ${finalFiles.length} files`);
                
                // Validation: au moins App.tsx et main.tsx
                const hasApp = finalFiles.some(f => f.path.includes('App.tsx'));
                const hasMain = finalFiles.some(f => f.path.includes('main.tsx'));
                
                if (!hasApp && !hasMain) {
                  console.error("[generate-site] ERROR: Missing App.tsx or main.tsx");
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    data: { message: 'Fichiers React essentiels manquants (App.tsx, main.tsx)' }
                  })}\n\n`));
                  closeStream();
                  return;
                }
                
                const totalTokens = inputTokens + outputTokens;
                console.log(`[generate-site] Tokens: Input=${inputTokens}, Output=${outputTokens}, Total=${totalTokens}`);

                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'generation_event',
                  data: {
                    type: 'complete',
                    message: 'Génération terminée',
                    status: 'completed',
                    phase: 'generation'
                  }
                })}\n\n`));

                // Convertir en Record<string, string>
                const filesRecord: Record<string, string> = {};
                for (const file of finalFiles) {
                  filesRecord[file.path] = file.content;
                }
                console.log(`[generate-site] Sending ${Object.keys(filesRecord).length} files`);

                // Sauvegarder dans Supabase
                if (sessionId) {
                  await supabaseClient
                    .from('build_sessions')
                    .update({
                      project_files: filesRecord,
                      project_type: 'react',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', sessionId);
                }

                // Event: files
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'files',
                  data: { files: filesRecord }
                })}\n\n`));

                // Event: complete
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  data: {
                    files: filesRecord,
                    totalFiles: finalFiles.length,
                    projectType: 'react',
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
                const delta = json?.delta?.text || json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;
                
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk',
                  data: { content: delta }
                })}\n\n`));

                // Parser tous les 500 caractères
                if (accumulated.length % 500 < delta.length) {
                  const currentFiles = parseGeneratedCode(accumulated);

                  if (currentFiles.length > lastParsedFiles.length) {
                    const newFiles = currentFiles.slice(lastParsedFiles.length);

                    for (const file of newFiles) {
                      let message = '';
                      const fileName = file.path.split('/').pop()?.replace('.tsx', '').replace('.ts', '').replace('.css', '');

                      if (file.path.includes('App.tsx')) {
                        message = 'Création du composant principal';
                      } else if (file.path.includes('main.tsx')) {
                        message = 'Point d\'entrée React';
                      } else if (file.path.includes('.css')) {
                        message = 'Mise en place des styles';
                      } else if (file.path.includes('components/')) {
                        message = `Composant ${fileName}`;
                      } else {
                        message = `Création de ${fileName}`;
                      }

                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'file_detected',
                        data: { path: file.path, type: file.type }
                      })}\n\n`));

                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'generation_event',
                        data: {
                          type: 'write',
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
