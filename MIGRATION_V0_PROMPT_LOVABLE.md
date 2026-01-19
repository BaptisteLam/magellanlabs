# 🚀 MIGRATION VERS V0.APP - PROMPT POUR LOVABLE

## 📋 CONTEXTE

Actuellement, notre plateforme MagellanLabs utilise une architecture custom avec Claude API directement pour générer et modifier des sites web. Nous voulons migrer vers **V0.App** comme backend principal qui gérera :
- ✅ La création des projets
- ✅ La gestion des prompts et re-prompts
- ✅ Les URLs de retour et previews
- ✅ L'historique des conversations
- ✅ Les modifications du code

---

## 🎯 OBJECTIF DE LA MIGRATION

Transformer le système actuel pour utiliser **V0 Platform API** (https://api.v0.dev) avec une architecture multi-tenant où :
1. **V0 devient la source de vérité** pour les chats et projets
2. **Notre base de données** stocke uniquement le mapping ownership (qui possède quoi)
3. **Pas de duplication de données** - on fetch tout depuis V0 API
4. **Support authentification** : utilisateurs anonymes, guests, et enregistrés

---

## 📊 ARCHITECTURE ACTUELLE À REMPLACER

### Backend actuel (à supprimer/remplacer) :

**Supabase Functions à remplacer par V0 API :**
- ❌ `generate-site` (ligne 1-1084) → Remplacer par V0 Chat Completions API
- ❌ `unified-modify` (ligne 1-501) → Remplacer par V0 Chat API avec conversation history
- ❌ `preview-sandbox` → Remplacer par V0 preview URLs
- ⚠️ `publish-project`, `publish-to-cloudflare` → **GARDER** (features custom)
- ⚠️ `memory` → Adapter pour utiliser les metadata V0

**Architecture actuelle :**
```
User → BuilderSession.tsx
    → useGenerateSite.ts
        → Supabase Function generate-site
            → Claude API direct (Sonnet 4.5)
                → Retour fichiers HTML/CSS/JS
    → E2BPreview.tsx (E2B sandboxes)
```

**Nouvelle architecture V0 :**
```
User → BuilderSession.tsx
    → useV0Chat.ts (nouveau hook)
        → V0 Platform API /v1/chat/completions
            → V0 génère le code
                → Retour avec preview URL V0
    → V0Preview.tsx (embed V0 preview)
```

---

## 🗄️ SCHÉMA BASE DE DONNÉES - CHANGEMENTS

### Tables à modifier :

#### 1. **`build_sessions`** → Simplifier
```sql
-- AVANT (actuel)
CREATE TABLE build_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  html_content TEXT,                    -- ❌ SUPPRIMER (V0 stocke)
  messages JSONB,                       -- ❌ SUPPRIMER (V0 stocke)
  project_files JSONB,                  -- ❌ SUPPRIMER (V0 stocke)
  project_type TEXT,
  cloudflare_project_name TEXT,
  cloudflare_deployment_url TEXT,
  public_url TEXT,
  website_id UUID REFERENCES websites(id),
  thumbnail_url TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- APRÈS (simplifié avec V0)
CREATE TABLE build_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),  -- Propriétaire
  v0_chat_id TEXT UNIQUE NOT NULL,         -- ✅ ID du chat V0
  v0_project_id TEXT,                       -- ✅ ID du projet V0 (optionnel)
  title TEXT,                               -- Cache local du titre
  project_type TEXT,                        -- Type de projet (website/webapp/mobile)

  -- Features custom (à garder)
  cloudflare_deployment_url TEXT,
  public_url TEXT,
  website_id UUID REFERENCES websites(id),
  thumbnail_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_build_sessions_user_id ON build_sessions(user_id);
CREATE INDEX idx_build_sessions_v0_chat_id ON build_sessions(v0_chat_id);
```

#### 2. **`chat_messages`** → Supprimer complètement
```sql
-- ❌ SUPPRIMER cette table
-- Les messages sont stockés dans V0 API
DROP TABLE IF EXISTS chat_messages CASCADE;
```

#### 3. **Nouvelles tables pour multi-tenant V0**

```sql
-- Tracking anonyme (rate limiting)
CREATE TABLE anonymous_chat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  v0_chat_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_anonymous_chat_log_ip ON anonymous_chat_log(ip_address, created_at);

-- Utilisateurs guests (auto-générés)
CREATE TABLE guest_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  email TEXT,  -- Optionnel si converti en user réel
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

-- Compteur de rate limiting
CREATE TABLE user_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  chats_today INTEGER DEFAULT 0,
  last_reset TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 FRONTEND - CHANGEMENTS DÉTAILLÉS

### 1. **Nouveau hook : `useV0Chat.ts`**

Créer un nouveau hook pour gérer les interactions avec V0 API :

```typescript
// src/hooks/useV0Chat.ts
import { useState, useRef, useCallback } from 'react';
import { v0 } from 'v0-sdk'; // Installation: pnpm add v0-sdk

export interface V0ChatParams {
  prompt: string;
  chatId?: string;  // Pour continuer une conversation
  projectFiles?: Record<string, string>; // Contexte actuel
}

export interface V0ChatResult {
  success: boolean;
  chatId: string;
  messageId: string;
  content: string;  // Code généré
  previewUrl?: string;  // URL preview V0
  files?: Record<string, string>;
}

export interface UseV0ChatOptions {
  onProgress?: (content: string) => void;
  onComplete?: (result: V0ChatResult) => void;
  onError?: (error: string) => void;
  streaming?: boolean;  // Toggle streaming (default: true)
}

export function useV0Chat() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    params: V0ChatParams,
    options: UseV0ChatOptions = {}
  ): Promise<V0ChatResult | null> => {
    const { prompt, chatId, projectFiles } = params;
    const { onProgress, onComplete, onError, streaming = true } = options;

    setIsGenerating(true);
    setProgress('Connecting to V0...');

    try {
      // Get V0 API key from backend
      const apiKey = await getV0ApiKey(); // À implémenter

      // Initialize V0 SDK
      const client = v0({ apiKey });

      // Build messages array
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a web development expert. Generate modern, responsive websites with clean code.'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      // Add context if modifying existing project
      if (projectFiles && Object.keys(projectFiles).length > 0) {
        messages.splice(1, 0, {
          role: 'system' as const,
          content: `Current project files:\n${JSON.stringify(projectFiles, null, 2)}`
        });
      }

      let result: V0ChatResult | null = null;

      if (streaming) {
        // Streaming mode
        const stream = await client.chat.completions.create({
          model: 'v0-1.5-md',
          messages,
          stream: true,
          max_completion_tokens: 4000,
        });

        let accumulatedContent = '';

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            accumulatedContent += content;
            onProgress?.(accumulatedContent);
            setProgress('Generating...');
          }
        }

        // Parse files from accumulated content
        const files = parseFilesFromV0Response(accumulatedContent);

        result = {
          success: true,
          chatId: chatId || generateChatId(),
          messageId: generateMessageId(),
          content: accumulatedContent,
          files,
        };

      } else {
        // Non-streaming mode
        const response = await client.chat.completions.create({
          model: 'v0-1.5-md',
          messages,
          stream: false,
          max_completion_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content || '';
        const files = parseFilesFromV0Response(content);

        result = {
          success: true,
          chatId: chatId || response.id,
          messageId: response.id,
          content,
          files,
        };
      }

      onComplete?.(result);
      setProgress('Complete!');
      return result;

    } catch (error) {
      console.error('[useV0Chat] Error:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown error');
      setProgress('Failed');
      return null;

    } finally {
      setIsGenerating(false);
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    sendMessage,
    abort,
    isGenerating,
    progress,
  };
}

// Helper functions
function parseFilesFromV0Response(content: string): Record<string, string> {
  // Parser le format de réponse V0 pour extraire les fichiers
  // Format attendu : // FILE: path/to/file.ext
  const files: Record<string, string> = {};
  const fileRegex = /\/\/ FILE: ([^\n]+)\n([\s\S]*?)(?=\/\/ FILE:|$)/g;

  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const path = match[1].trim();
    const fileContent = match[2].trim();
    files[path] = fileContent;
  }

  return files;
}

function generateChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getV0ApiKey(): Promise<string> {
  // Récupérer la clé API V0 depuis le backend (sécurisé)
  const response = await fetch('/api/v0/api-key');
  const data = await response.json();
  return data.apiKey;
}
```

### 2. **Modifier `BuilderSession.tsx`**

Remplacer les appels à `useGenerateSite` et `useUnifiedModify` par `useV0Chat` :

```typescript
// AVANT (lignes 740-1113)
const handleGenerateSite = async (userPrompt: string) => {
  const result = await generateSiteHook.generateSite({ ... });
}

const handleUnifiedModification = async (userPrompt: string) => {
  const result = await unifiedModifyHook.modify({ ... });
}

// APRÈS
import { useV0Chat } from '@/hooks/useV0Chat';

const v0Chat = useV0Chat();

const handleGenerateSite = async (userPrompt: string) => {
  const result = await v0Chat.sendMessage({
    prompt: userPrompt,
    chatId: sessionData?.v0_chat_id, // Continuer conversation existante
  }, {
    streaming: true,
    onProgress: (content) => {
      // Mise à jour temps réel
      console.log('V0 génère:', content);
    },
    onComplete: async (result) => {
      // Sauvegarder dans notre DB (ownership only)
      await supabase.from('build_sessions').upsert({
        id: sessionId,
        user_id: user.id,
        v0_chat_id: result.chatId,
        title: websiteTitle || 'Untitled Project',
        updated_at: new Date().toISOString(),
      });

      // Mettre à jour les fichiers locaux
      if (result.files) {
        updateFiles(result.files, true);
      }
    },
    onError: (error) => {
      sonnerToast.error(`Erreur V0: ${error}`);
    }
  });
};

// Plus besoin de distinguer handleGenerateSite vs handleUnifiedModification
// V0 gère automatiquement le contexte de conversation
const handleSubmit = async (userPrompt: string) => {
  await handleGenerateSite(userPrompt);
};
```

### 3. **Nouveau composant : `V0Preview.tsx`**

Remplacer `E2BPreview` par un composant qui affiche les previews V0 :

```typescript
// src/components/V0Preview.tsx
import { useState, useEffect, useRef } from 'react';

interface V0PreviewProps {
  chatId: string;
  messageId?: string;
  className?: string;
}

export function V0Preview({ chatId, messageId, className }: V0PreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Récupérer l'URL de preview depuis V0 API
    async function fetchPreviewUrl() {
      try {
        setIsLoading(true);

        // Option 1: Si V0 fournit une URL de preview directement
        // const url = `https://v0.dev/chat/${chatId}`;

        // Option 2: Si on doit récupérer via leur API
        const response = await fetch(`/api/v0/preview/${chatId}/${messageId || 'latest'}`);
        const data = await response.json();

        setPreviewUrl(data.previewUrl);
      } catch (error) {
        console.error('Failed to fetch V0 preview:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (chatId) {
      fetchPreviewUrl();
    }
  }, [chatId, messageId]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin">⏳</div>
        <p>Loading preview...</p>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <p>No preview available</p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={previewUrl}
      className={className}
      sandbox="allow-scripts allow-same-origin allow-forms"
      title="V0 Preview"
    />
  );
}
```

### 4. **Nouveau service : `v0Service.ts`**

Service pour centraliser toutes les interactions avec V0 API :

```typescript
// src/services/v0Service.ts
import { supabase } from '@/integrations/supabase/client';

export interface V0Chat {
  id: string;
  title?: string;
  createdAt: string;
  messages: V0Message[];
}

export interface V0Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface V0Project {
  id: string;
  chatId: string;
  name: string;
  files: Record<string, string>;
  createdAt: string;
}

class V0Service {
  private apiKey: string | null = null;

  async getApiKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;

    // Récupérer la clé depuis le backend (sécurisé)
    const { data } = await supabase.functions.invoke('get-v0-api-key');
    this.apiKey = data.apiKey;
    return this.apiKey;
  }

  async createChat(initialPrompt: string, userId: string): Promise<V0Chat> {
    const apiKey = await this.getApiKey();

    // Appel à V0 API pour créer un nouveau chat
    const response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'v0-1.5-md',
        messages: [
          { role: 'user', content: initialPrompt }
        ],
      }),
    });

    const data = await response.json();

    // Enregistrer l'ownership dans notre DB
    await supabase.from('build_sessions').insert({
      user_id: userId,
      v0_chat_id: data.id,
      title: extractTitleFromPrompt(initialPrompt),
      created_at: new Date().toISOString(),
    });

    return {
      id: data.id,
      createdAt: new Date().toISOString(),
      messages: [{
        id: data.choices[0].message.id,
        role: data.choices[0].message.role,
        content: data.choices[0].message.content,
        createdAt: new Date().toISOString(),
      }],
    };
  }

  async getChatHistory(chatId: string): Promise<V0Chat> {
    // Récupérer l'historique depuis V0 API
    // Note: Si V0 n'a pas d'endpoint pour ça, on devra le reconstruire
    const apiKey = await this.getApiKey();

    const response = await fetch(`https://api.v0.dev/chats/${chatId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    return response.json();
  }

  async sendMessage(chatId: string, prompt: string): Promise<V0Message> {
    const apiKey = await this.getApiKey();

    const response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'v0-1.5-md',
        messages: [
          // Inclure l'historique ici si nécessaire
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();
    return {
      id: data.choices[0].message.id,
      role: data.choices[0].message.role,
      content: data.choices[0].message.content,
      createdAt: new Date().toISOString(),
    };
  }

  async getUsageReport(userId: string): Promise<any> {
    const apiKey = await this.getApiKey();

    const response = await fetch('https://api.v0.dev/reports/usage', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    return response.json();
  }
}

export const v0Service = new V0Service();

function extractTitleFromPrompt(prompt: string): string {
  // Extraire un titre court du prompt (premiers 50 chars)
  return prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '');
}
```

---

## 🔐 BACKEND - NOUVELLES FUNCTIONS

### 1. **`get-v0-api-key` (sécurité)**

```typescript
// supabase/functions/get-v0-api-key/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retourner la clé V0 API (stockée dans les env variables)
    const v0ApiKey = Deno.env.get('V0_API_KEY');
    if (!v0ApiKey) {
      throw new Error('V0_API_KEY not configured');
    }

    return new Response(
      JSON.stringify({ apiKey: v0ApiKey }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 2. **`v0-proxy` (rate limiting + ownership)**

```typescript
// supabase/functions/v0-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    let userId: string | null = null;
    let userType: 'anonymous' | 'guest' | 'registered' = 'anonymous';

    // Déterminer le type d'utilisateur
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userType = 'registered';
      }
    }

    // Rate limiting basé sur le type d'utilisateur
    const rateLimits = {
      anonymous: 3,   // 3 chats/jour
      guest: 5,       // 5 chats/jour
      registered: 50, // 50 chats/jour
    };

    const limit = rateLimits[userType];

    // Vérifier le rate limit
    if (userType === 'anonymous') {
      // Rate limit par IP
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      const { count } = await supabase
        .from('anonymous_chat_log')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', clientIp)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (count && count >= limit) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Anonymous users limited to ${limit} chats per day. Please sign up for more.`
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (userId) {
      // Rate limit pour utilisateurs authentifiés
      const { data: rateLimit } = await supabase
        .from('user_rate_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (rateLimit) {
        const resetTime = new Date(rateLimit.last_reset);
        const now = new Date();
        const hoursSinceReset = (now.getTime() - resetTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceReset < 24 && rateLimit.chats_today >= limit) {
          return new Response(
            JSON.stringify({
              error: 'Rate limit exceeded',
              message: `You've reached your daily limit of ${limit} chats. Resets in ${Math.ceil(24 - hoursSinceReset)} hours.`
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Reset counter si > 24h
        if (hoursSinceReset >= 24) {
          await supabase
            .from('user_rate_limits')
            .update({ chats_today: 1, last_reset: now.toISOString() })
            .eq('user_id', userId);
        } else {
          await supabase
            .from('user_rate_limits')
            .update({ chats_today: rateLimit.chats_today + 1 })
            .eq('user_id', userId);
        }
      } else {
        // Première utilisation
        await supabase.from('user_rate_limits').insert({
          user_id: userId,
          chats_today: 1,
          last_reset: new Date().toISOString(),
        });
      }
    }

    // Proxy la requête vers V0 API
    const { prompt, chatId, model = 'v0-1.5-md' } = await req.json();
    const v0ApiKey = Deno.env.get('V0_API_KEY')!;

    const v0Response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${v0ApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });

    const v0Data = await v0Response.json();

    // Enregistrer l'ownership
    if (userType === 'anonymous') {
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      await supabase.from('anonymous_chat_log').insert({
        ip_address: clientIp,
        v0_chat_id: v0Data.id,
      });
    } else if (userId) {
      await supabase.from('build_sessions').insert({
        user_id: userId,
        v0_chat_id: v0Data.id,
        title: prompt.substring(0, 50),
      });
    }

    return new Response(
      JSON.stringify(v0Data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 📝 RÉCAPITULATIF DES CHANGEMENTS

### À SUPPRIMER :
- ❌ `supabase/functions/generate-site/index.ts` (tout le fichier)
- ❌ `supabase/functions/unified-modify/` (tout le dossier)
- ❌ `supabase/functions/preview-sandbox/index.ts`
- ❌ `src/hooks/useGenerateSite.ts`
- ❌ `src/hooks/useUnifiedModify.ts`
- ❌ `src/components/E2BPreview.tsx`
- ❌ Table `chat_messages` (migration SQL)

### À CRÉER :
- ✅ `src/hooks/useV0Chat.ts` (nouveau hook V0)
- ✅ `src/services/v0Service.ts` (service centralisé)
- ✅ `src/components/V0Preview.tsx` (preview V0)
- ✅ `supabase/functions/get-v0-api-key/index.ts` (sécurité)
- ✅ `supabase/functions/v0-proxy/index.ts` (rate limiting)
- ✅ Nouvelles tables SQL (anonymous_chat_log, guest_users, user_rate_limits)

### À MODIFIER :
- 🔄 `src/pages/BuilderSession.tsx` : Remplacer hooks par useV0Chat
- 🔄 `src/pages/AIBuilder.tsx` : Créer chat V0 au lieu de build_session
- 🔄 Table `build_sessions` : Ajouter colonnes v0_chat_id, v0_project_id
- 🔄 `src/hooks/useBuildSession.ts` : Fetch data depuis V0 API
- 🔄 `.env` : Ajouter `V0_API_KEY`

### À GARDER (features custom) :
- ✅ `publish-project` (publication sur builtbymagellan.com)
- ✅ `publish-to-cloudflare` (déploiement Cloudflare Pages)
- ✅ `memory` (adapter pour V0 metadata)
- ✅ Table `websites` (métadonnées custom)
- ✅ Table `published_projects` (projets publiés)

---

## 🚦 PLAN DE MIGRATION ÉTAPE PAR ÉTAPE

### Phase 1 : Setup (Environnement)
1. ✅ Obtenir clé API V0 Premium/Team depuis https://v0.app/chat/settings/keys
2. ✅ Ajouter `V0_API_KEY` dans Supabase Secrets
3. ✅ Installer dépendances : `pnpm add v0-sdk @ai-sdk/vercel ai`

### Phase 2 : Backend (Base de données)
4. ✅ Créer migration SQL pour nouvelles tables (anonymous_chat_log, etc.)
5. ✅ Créer migration SQL pour modifier build_sessions (ajouter v0_chat_id)
6. ✅ Créer fonction `get-v0-api-key`
7. ✅ Créer fonction `v0-proxy`
8. ✅ Tester les nouvelles fonctions avec Postman/curl

### Phase 3 : Frontend (Nouveaux hooks)
9. ✅ Créer `src/hooks/useV0Chat.ts`
10. ✅ Créer `src/services/v0Service.ts`
11. ✅ Créer `src/components/V0Preview.tsx`
12. ✅ Tester les hooks en isolation

### Phase 4 : Integration (BuilderSession)
13. ✅ Modifier `BuilderSession.tsx` pour utiliser useV0Chat
14. ✅ Remplacer E2BPreview par V0Preview
15. ✅ Tester création de nouveau projet
16. ✅ Tester modifications sur projet existant
17. ✅ Tester rate limiting (anonyme vs registré)

### Phase 5 : Cleanup (Nettoyage)
18. ✅ Supprimer anciennes fonctions Supabase (generate-site, unified-modify)
19. ✅ Supprimer anciens hooks (useGenerateSite, useUnifiedModify)
20. ✅ Supprimer E2BPreview.tsx
21. ✅ Migration SQL : DROP TABLE chat_messages
22. ✅ Mettre à jour documentation

### Phase 6 : Testing & Deploy
23. ✅ Tests E2E complets
24. ✅ Vérifier ownership + rate limiting
25. ✅ Deploy sur production

---

## 🔥 POINTS CRITIQUES À VALIDER

### 1. **Preview URL de V0**
⚠️ **Question** : V0 fournit-il une URL de preview directement dans la réponse ?
- Si OUI : Utiliser `V0Preview.tsx` avec iframe
- Si NON : Parser le code généré et utiliser notre propre preview (E2B ou autre)

### 2. **Historique de conversation V0**
⚠️ **Question** : V0 API stocke-t-il l'historique de conversation ?
- Si OUI : Récupérer via GET `/chats/{chatId}`
- Si NON : Stocker nous-mêmes dans notre DB

### 3. **Format de réponse V0**
⚠️ **Question** : V0 retourne-t-il les fichiers structurés ou du code brut ?
- Implémenter parser dans `parseFilesFromV0Response()`
- Tester avec différents types de prompts

### 4. **Coûts V0 API**
⚠️ **Important** : Vérifier la tarification V0 API
- Usage-based billing activé ?
- Limites de tokens : 128K input / 64K output
- Comparer coûts vs Claude API directement

---

## 📚 RÉFÉRENCES

- V0 API Docs : https://v0.app/docs/api
- V0 Models : https://v0.app/docs/api/models
- V0 SDK GitHub : https://github.com/vercel/ai (AI SDK)
- V0 Clone Example : https://v0.dev/templates/v0-clone
- Rate Limiting Strategy : Documenté dans exemple clone V0

---

## ✅ CHECKLIST FINALE

Avant de déployer en production, vérifier :

- [ ] V0 API Key configurée et testée
- [ ] Toutes les migrations SQL appliquées
- [ ] Rate limiting fonctionne (3/5/50 chats par jour)
- [ ] Ownership tracking (user_id → v0_chat_id)
- [ ] Preview fonctionne correctement
- [ ] Streaming temps réel opérationnel
- [ ] Gestion d'erreurs robuste
- [ ] Tests E2E passent
- [ ] Documentation mise à jour
- [ ] Anciennes fonctions supprimées

---

**🎯 OBJECTIF FINAL** : Une architecture simplifiée où V0 gère la complexité de génération de code, et notre plateforme se concentre sur l'ownership, le rate limiting, et les features custom (publication, analytics, etc.).
