# 🔧 EXEMPLES DE CODE - MIGRATION V0.APP

## 📝 Table des matières
1. [Hook useV0Chat complet](#1-hook-usev0chat-complet)
2. [Service V0](#2-service-v0)
3. [Composant V0Preview](#3-composant-v0preview)
4. [Utilisation dans BuilderSession](#4-utilisation-dans-buildersession)
5. [Fonction Supabase v0-proxy](#5-fonction-supabase-v0-proxy)
6. [Tests unitaires](#6-tests-unitaires)

---

## 1. Hook useV0Chat complet

```typescript
// src/hooks/useV0Chat.ts
import { useState, useRef, useCallback } from 'react';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

export interface V0ChatParams {
  prompt: string;
  chatId?: string;
  model?: 'v0-1.5-md' | 'v0-1.5-lg' | 'v0-1.0-md';
  context?: {
    files?: Record<string, string>;
    conversationHistory?: Array<{ role: string; content: string }>;
  };
}

export interface V0ChatResult {
  success: boolean;
  chatId: string;
  messageId: string;
  content: string;
  files?: Record<string, string>;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  previewUrl?: string;
}

export interface V0StreamEvent {
  type: 'start' | 'chunk' | 'complete' | 'error';
  data?: any;
}

export interface UseV0ChatOptions {
  onProgress?: (content: string) => void;
  onComplete?: (result: V0ChatResult) => void;
  onError?: (error: string) => void;
  onEvent?: (event: V0StreamEvent) => void;
  streaming?: boolean;
}

export function useV0Chat() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setProgress('Cancelled');
  }, []);

  const sendMessage = useCallback(async (
    params: V0ChatParams,
    options: UseV0ChatOptions = {}
  ): Promise<V0ChatResult | null> => {
    const {
      prompt,
      chatId,
      model = 'v0-1.5-md',
      context
    } = params;

    const {
      onProgress,
      onComplete,
      onError,
      onEvent,
      streaming = true
    } = options;

    setIsGenerating(true);
    setProgress('Initializing...');
    onEvent?.({ type: 'start' });

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Build messages array
      const messages: Array<{ role: string; content: string }> = [];

      // Add conversation history if provided
      if (context?.conversationHistory) {
        messages.push(...context.conversationHistory);
      }

      // Add system context if files provided
      if (context?.files && Object.keys(context.files).length > 0) {
        const filesContext = Object.entries(context.files)
          .map(([path, content]) => {
            // Limiter la taille du contexte (max 500 chars par fichier)
            const truncated = content.length > 500
              ? content.substring(0, 500) + '...[truncated]'
              : content;
            return `// FILE: ${path}\n${truncated}`;
          })
          .join('\n\n');

        messages.push({
          role: 'system',
          content: `Current project structure:\n\n${filesContext}\n\nPlease modify or extend these files as needed.`
        });
      }

      // Add user prompt
      messages.push({
        role: 'user',
        content: prompt
      });

      // Call our backend proxy (handles auth + rate limiting)
      const response = await fetch('/api/v0/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: streaming,
          chatId,
          max_completion_tokens: 4000,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (streaming) {
        return await handleStreamingResponse(response, {
          onProgress,
          onEvent,
          setProgress,
        });
      } else {
        return await handleNonStreamingResponse(response, { setProgress });
      }

    } catch (error) {
      console.error('[useV0Chat] Error:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setProgress('Cancelled');
          return null;
        }
        onError?.(error.message);
      } else {
        onError?.('Unknown error occurred');
      }

      onEvent?.({ type: 'error', data: { message: error } });
      setProgress('Failed');
      return null;

    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }

  }, []);

  return {
    sendMessage,
    abort,
    isGenerating,
    progress,
  };
}

// Helper: Handle streaming response with SSE
async function handleStreamingResponse(
  response: Response,
  callbacks: {
    onProgress?: (content: string) => void;
    onEvent?: (event: V0StreamEvent) => void;
    setProgress: (msg: string) => void;
  }
): Promise<V0ChatResult> {
  const { onProgress, onEvent, setProgress } = callbacks;

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let accumulatedContent = '';
  let result: V0ChatResult = {
    success: false,
    chatId: '',
    messageId: '',
    content: '',
  };

  // Use eventsource-parser for robust SSE parsing
  const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
    if (event.type === 'event') {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'chat_id':
            result.chatId = data.chatId;
            break;

          case 'message_id':
            result.messageId = data.messageId;
            break;

          case 'chunk':
            const chunk = data.content || '';
            accumulatedContent += chunk;
            onProgress?.(accumulatedContent);
            setProgress(`Generating... (${accumulatedContent.length} chars)`);
            onEvent?.({ type: 'chunk', data: { content: chunk } });
            break;

          case 'files':
            result.files = data.files;
            setProgress('Parsing files...');
            break;

          case 'tokens':
            result.tokens = data.tokens;
            break;

          case 'preview_url':
            result.previewUrl = data.url;
            break;

          case 'complete':
            result.success = true;
            result.content = accumulatedContent;
            setProgress('Complete!');
            onEvent?.({ type: 'complete', data: result });
            break;

          case 'error':
            throw new Error(data.message || 'Stream error');
        }
      } catch (err) {
        console.error('[SSE Parser] Error parsing event:', err, event.data);
      }
    }
  });

  // Read stream
  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      parser.feed(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  // Fallback: parse files from content if not provided
  if (!result.files && accumulatedContent) {
    result.files = parseFilesFromContent(accumulatedContent);
  }

  result.content = accumulatedContent;
  return result;
}

// Helper: Handle non-streaming response
async function handleNonStreamingResponse(
  response: Response,
  callbacks: { setProgress: (msg: string) => void }
): Promise<V0ChatResult> {
  callbacks.setProgress('Processing response...');

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content || '';
  const files = parseFilesFromContent(content);

  return {
    success: true,
    chatId: data.id,
    messageId: data.choices?.[0]?.message?.id || data.id,
    content,
    files,
    tokens: data.usage ? {
      prompt: data.usage.prompt_tokens,
      completion: data.usage.completion_tokens,
      total: data.usage.total_tokens,
    } : undefined,
  };
}

// Helper: Parse files from V0 response content
function parseFilesFromContent(content: string): Record<string, string> {
  const files: Record<string, string> = {};

  // Format V0: // FILE: path/to/file.ext
  const fileRegex = /\/\/\s*FILE:\s*([^\n]+)\n([\s\S]*?)(?=\/\/\s*FILE:|$)/gi;

  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const path = match[1].trim();
    let fileContent = match[2].trim();

    // Clean code blocks
    fileContent = fileContent.replace(/^```[\w]*\s*\n?/gm, '');
    fileContent = fileContent.replace(/\n?```\s*$/gm, '');

    if (path && fileContent) {
      files[path] = fileContent;
    }
  }

  // Fallback: Si aucun fichier trouvé mais du code détecté
  if (Object.keys(files).length === 0) {
    if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
      files['index.html'] = extractCodeFromMarkdown(content);
    }
  }

  return files;
}

// Helper: Extract code from markdown code blocks
function extractCodeFromMarkdown(content: string): string {
  const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)```/g;
  const matches = [...content.matchAll(codeBlockRegex)];

  if (matches.length > 0) {
    return matches[0][1].trim();
  }

  return content;
}
```

---

## 2. Service V0

```typescript
// src/services/v0Service.ts
import { supabase } from '@/integrations/supabase/client';

export interface V0Chat {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface V0Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface V0Project {
  id: string;
  chatId: string;
  name: string;
  files: Record<string, string>;
}

export interface CreateChatParams {
  userId: string;
  initialPrompt: string;
  projectType?: 'website' | 'webapp' | 'mobile';
}

export interface GetChatParams {
  chatId: string;
  userId: string;
}

class V0Service {
  /**
   * Créer un nouveau chat V0 et l'enregistrer dans notre DB
   */
  async createChat(params: CreateChatParams): Promise<V0Chat> {
    const { userId, initialPrompt, projectType = 'website' } = params;

    try {
      // Appeler notre backend proxy qui gère la communication avec V0
      const response = await fetch('/api/v0/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: initialPrompt,
          model: 'v0-1.5-md',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create chat');
      }

      const data = await response.json();

      // Enregistrer l'ownership dans notre DB
      const { error: dbError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: userId,
          v0_chat_id: data.chatId,
          title: this.extractTitleFromPrompt(initialPrompt),
          project_type: projectType,
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error('[V0Service] Failed to save ownership:', dbError);
        // Ne pas throw ici, le chat V0 existe déjà
      }

      return {
        id: data.chatId,
        createdAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('[V0Service] createChat error:', error);
      throw error;
    }
  }

  /**
   * Récupérer un chat existant (vérifier ownership)
   */
  async getChat(params: GetChatParams): Promise<V0Chat | null> {
    const { chatId, userId } = params;

    try {
      // Vérifier ownership dans notre DB
      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('v0_chat_id', chatId)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        console.error('[V0Service] Chat not found or unauthorized');
        return null;
      }

      return {
        id: chatId,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      };

    } catch (error) {
      console.error('[V0Service] getChat error:', error);
      return null;
    }
  }

  /**
   * Récupérer tous les chats d'un utilisateur
   */
  async getUserChats(userId: string): Promise<V0Chat[]> {
    try {
      const { data: sessions, error } = await supabase
        .from('build_sessions')
        .select('v0_chat_id, title, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[V0Service] getUserChats error:', error);
        return [];
      }

      return sessions.map(s => ({
        id: s.v0_chat_id,
        title: s.title,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));

    } catch (error) {
      console.error('[V0Service] getUserChats error:', error);
      return [];
    }
  }

  /**
   * Vérifier le quota restant d'un utilisateur
   */
  async checkRateLimit(userId: string | null): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: string;
  }> {
    try {
      const response = await fetch('/api/v0/rate-limit', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
      });

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('[V0Service] checkRateLimit error:', error);
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Récupérer le rapport d'usage V0
   */
  async getUsageReport(params?: {
    startDate?: string;
    endDate?: string;
    chatId?: string;
  }): Promise<any> {
    try {
      const queryParams = new URLSearchParams(params as any);
      const response = await fetch(`/api/v0/usage?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch usage report');
      }

      return await response.json();

    } catch (error) {
      console.error('[V0Service] getUsageReport error:', error);
      return null;
    }
  }

  // Helper privé
  private extractTitleFromPrompt(prompt: string): string {
    // Prendre les premiers 50 caractères
    let title = prompt.substring(0, 50).trim();

    // Si phrase complète, couper au dernier mot
    if (prompt.length > 50) {
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 20) {
        title = title.substring(0, lastSpace);
      }
      title += '...';
    }

    return title;
  }
}

export const v0Service = new V0Service();
```

---

## 3. Composant V0Preview

```typescript
// src/components/V0Preview.tsx
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Loader2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface V0PreviewProps {
  chatId: string;
  messageId?: string;
  files?: Record<string, string>;
  className?: string;
}

export interface V0PreviewHandle {
  reload: () => void;
  getPreviewUrl: () => string | null;
}

export const V0Preview = forwardRef<V0PreviewHandle, V0PreviewProps>(
  ({ chatId, messageId, files, className = '' }, ref) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [iframeKey, setIframeKey] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Reload handler
    const reload = () => {
      setIframeKey(prev => prev + 1);
      setIsLoading(true);
      setError(null);
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      reload,
      getPreviewUrl: () => previewUrl,
    }));

    // Fetch preview URL
    useEffect(() => {
      async function fetchPreview() {
        setIsLoading(true);
        setError(null);

        try {
          // Option 1: Si V0 fournit une preview URL directement
          if (previewUrl) {
            setIsLoading(false);
            return;
          }

          // Option 2: Générer notre propre preview depuis les fichiers
          if (files && Object.keys(files).length > 0) {
            const url = await createLocalPreview(files);
            setPreviewUrl(url);
            setIsLoading(false);
            return;
          }

          // Option 3: Appeler V0 API pour obtenir l'URL
          const response = await fetch(`/api/v0/preview/${chatId}/${messageId || 'latest'}`);

          if (!response.ok) {
            throw new Error('Failed to fetch preview');
          }

          const data = await response.json();
          setPreviewUrl(data.previewUrl || null);

        } catch (err) {
          console.error('[V0Preview] Error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        } finally {
          setIsLoading(false);
        }
      }

      fetchPreview();
    }, [chatId, messageId, files]);

    if (isLoading) {
      return (
        <div className={`flex items-center justify-center bg-gray-50 ${className}`}>
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={`flex items-center justify-center bg-red-50 ${className}`}>
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <Button onClick={reload} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className={`flex items-center justify-center bg-gray-50 ${className}`}>
          <p className="text-sm text-gray-600">No preview available</p>
        </div>
      );
    }

    return (
      <div className={`relative ${className}`}>
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Preview"
          onLoad={() => setIsLoading(false)}
        />

        {/* Open in new tab button */}
        <Button
          onClick={() => window.open(previewUrl, '_blank')}
          variant="outline"
          size="sm"
          className="absolute top-4 right-4 bg-white/90 backdrop-blur"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open
        </Button>
      </div>
    );
  }
);

V0Preview.displayName = 'V0Preview';

// Helper: Create local preview from files
async function createLocalPreview(files: Record<string, string>): Promise<string> {
  // Si on a un index.html, créer un blob URL
  const indexHtml = files['index.html'] || files['src/index.html'];

  if (!indexHtml) {
    throw new Error('No HTML file found');
  }

  // Injecter les autres fichiers (CSS, JS) inline
  let html = indexHtml;

  // Inject CSS
  const cssFiles = Object.entries(files).filter(([path]) =>
    path.endsWith('.css')
  );
  for (const [path, content] of cssFiles) {
    html = html.replace(
      new RegExp(`<link[^>]*href=["'].*${path.split('/').pop()}["'][^>]*>`, 'g'),
      `<style>${content}</style>`
    );
  }

  // Inject JS
  const jsFiles = Object.entries(files).filter(([path]) =>
    path.endsWith('.js')
  );
  for (const [path, content] of jsFiles) {
    html = html.replace(
      new RegExp(`<script[^>]*src=["'].*${path.split('/').pop()}["'][^>]*></script>`, 'g'),
      `<script>${content}</script>`
    );
  }

  // Create blob URL
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}
```

---

## 4. Utilisation dans BuilderSession

```typescript
// src/pages/BuilderSession.tsx (extrait)
import { useV0Chat } from '@/hooks/useV0Chat';
import { V0Preview } from '@/components/V0Preview';
import { v0Service } from '@/services/v0Service';

export function BuilderSession() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const v0Chat = useV0Chat();

  const [v0ChatId, setV0ChatId] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);

  // Charger la session
  useEffect(() => {
    async function loadSession() {
      if (!sessionId || !user) return;

      // Récupérer les données de la session depuis notre DB
      const { data: session } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (session) {
        setV0ChatId(session.v0_chat_id);
        setWebsiteTitle(session.title);

        // Si ancien système (pas de v0_chat_id), migrer
        if (!session.v0_chat_id && session.messages) {
          setMessages(session.messages);
          // Migration: créer un chat V0 à partir de l'historique
          // TODO: Implémenter migration
        }
      }
    }

    loadSession();
  }, [sessionId, user]);

  // Handler pour soumettre un prompt
  const handleSubmit = async (prompt: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Vérifier le rate limit
    const rateLimit = await v0Service.checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      sonnerToast.error(`Rate limit exceeded. Resets in ${formatResetTime(rateLimit.resetAt)}`);
      return;
    }

    // Ajouter le message utilisateur
    const userMessage: Message = {
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Message assistant placeholder
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      metadata: {
        type: 'generation',
        status: 'in-progress',
      },
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Appeler V0 via notre hook
      const result = await v0Chat.sendMessage({
        prompt,
        chatId: v0ChatId || undefined,
        model: 'v0-1.5-md',
        context: {
          files: projectFiles,
          conversationHistory: messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content as string })),
        },
      }, {
        streaming: true,
        onProgress: (content) => {
          // Mise à jour en temps réel
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content,
            };
            return updated;
          });
        },
        onComplete: async (result) => {
          // Mise à jour finale
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: result.content,
              metadata: {
                type: 'generation',
                status: 'completed',
                tokens: result.tokens,
              },
            };
            return updated;
          });

          // Mettre à jour les fichiers
          if (result.files) {
            setProjectFiles(result.files);
          }

          // Sauvegarder dans notre DB (ownership)
          if (!v0ChatId) {
            setV0ChatId(result.chatId);
            await supabase.from('build_sessions').update({
              v0_chat_id: result.chatId,
              updated_at: new Date().toISOString(),
            }).eq('id', sessionId);
          }

          sonnerToast.success('Generated successfully!');
        },
        onError: (error) => {
          sonnerToast.error(`Error: ${error}`);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              metadata: {
                type: 'generation',
                status: 'error',
                error,
              },
            };
            return updated;
          });
        },
      });

    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg, idx) => (
            <MessageComponent key={idx} message={msg} />
          ))}
        </div>

        {/* Input */}
        <PromptBar onSubmit={handleSubmit} disabled={v0Chat.isGenerating} />
      </div>

      {/* Preview panel */}
      <div className="flex-1 border-l">
        {v0ChatId ? (
          <V0Preview
            chatId={v0ChatId}
            files={projectFiles}
            className="w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Start chatting to see preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Fonction Supabase v0-proxy

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
    // Auth
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    );

    let userId: string | null = null;
    let userType: 'anonymous' | 'guest' | 'registered' = 'anonymous';

    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userType = 'registered';
      }
    }

    // Rate limiting
    const rateLimits = { anonymous: 3, guest: 5, registered: 50 };
    const limit = rateLimits[userType];

    if (userType === 'anonymous') {
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      const { count } = await supabase
        .from('anonymous_chat_log')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', clientIp)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (count && count >= limit) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', limit }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse request
    const { model = 'v0-1.5-md', messages, stream = true, chatId } = await req.json();

    // Call V0 API
    const v0Response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('V0_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream }),
    });

    if (!v0Response.ok) {
      throw new Error(`V0 API error: ${v0Response.status}`);
    }

    // Log usage
    const newChatId = chatId || `chat_${Date.now()}`;
    if (userType === 'anonymous') {
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      await supabase.from('anonymous_chat_log').insert({
        ip_address: clientIp,
        v0_chat_id: newChatId,
      });
    } else if (userId) {
      await supabase.from('user_rate_limits').upsert({
        user_id: userId,
        chats_today: supabase.sql`chats_today + 1`,
      });
    }

    // Stream ou retour direct
    if (stream) {
      return new Response(v0Response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      const data = await v0Response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

## 6. Tests unitaires

```typescript
// src/hooks/__tests__/useV0Chat.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useV0Chat } from '../useV0Chat';

describe('useV0Chat', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('should send message successfully', async () => {
    const mockResponse = {
      id: 'chat_123',
      choices: [{
        message: {
          id: 'msg_456',
          role: 'assistant',
          content: '// FILE: index.html\n<!DOCTYPE html><html></html>',
        },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useV0Chat());

    let finalResult: any = null;

    await act(async () => {
      finalResult = await result.current.sendMessage({
        prompt: 'Create a website',
      }, {
        streaming: false,
        onComplete: (res) => {
          expect(res.success).toBe(true);
          expect(res.chatId).toBe('chat_123');
        },
      });
    });

    expect(finalResult).not.toBeNull();
    expect(finalResult?.success).toBe(true);
  });

  it('should handle streaming correctly', async () => {
    const chunks = [
      'data: {"type":"chunk","content":"<html>"}\n\n',
      'data: {"type":"chunk","content":"</html>"}\n\n',
      'data: {"type":"complete"}\n\n',
    ];

    const mockReadableStream = {
      getReader: () => ({
        read: jest.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[1]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[2]),
          })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: mockReadableStream,
    });

    const { result } = renderHook(() => useV0Chat());

    const progressUpdates: string[] = [];

    await act(async () => {
      await result.current.sendMessage({
        prompt: 'Test',
      }, {
        streaming: true,
        onProgress: (content) => {
          progressUpdates.push(content);
        },
      });
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
  });
});
```

---

## 🎉 CONCLUSION

Ces exemples de code fournissent une base solide pour implémenter la migration vers V0.App. Les principaux composants sont :

1. **useV0Chat** - Hook principal avec streaming SSE
2. **v0Service** - Service centralisé pour toutes les interactions V0
3. **V0Preview** - Composant de preview avec fallback local
4. **BuilderSession** - Intégration dans la page principale
5. **v0-proxy** - Backend proxy avec rate limiting
6. **Tests** - Tests unitaires pour validation

**Prochaines étapes** :
- Adapter ces exemples à votre codebase
- Tester avec l'API V0 réelle
- Implémenter la migration progressive
- Valider les coûts et performances
