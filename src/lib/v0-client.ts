/**
 * v0 Platform API Client
 * Wrapper autour de l'API v0 de Vercel pour la génération de sites
 * Utilisé côté frontend pour les appels via les edge functions Supabase
 */

import { V0_API_CONFIG } from '@/config/constants';

// ============= Types =============

export interface V0ChatCreateParams {
  message: string;
  system?: string;
  projectId?: string;
  chatPrivacy?: 'public' | 'private' | 'unlisted';
  responseMode?: 'sync' | 'async' | 'experimental_stream';
  attachments?: Array<{ url: string }>;
  modelConfiguration?: {
    imageGenerations?: boolean;
    thinking?: boolean;
  };
}

export interface V0ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  type: string;
  createdAt: string;
  attachments?: Array<{ url: string }>;
}

export interface V0LatestVersion {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  files: Array<{ name: string; content: string }>;
  demoUrl: string;
  screenshotUrl?: string;
}

export interface V0ChatResponse {
  id: string;
  object: 'chat';
  name: string;
  createdAt: string;
  updatedAt: string;
  webUrl: string;
  apiUrl: string;
  projectId: string | null;
  text: string;
  messages: V0ChatMessage[];
  latestVersion: V0LatestVersion;
  modelConfiguration?: Record<string, unknown>;
}

export interface V0SendMessageParams {
  chatId: string;
  message: string;
  responseMode?: 'sync' | 'async' | 'experimental_stream';
}

export interface V0UserPlan {
  plan: string;
  messagesRemaining: number;
  messagesTotal: number;
  resetDate: string;
}

export interface V0StreamEvent {
  event: string;
  data: unknown;
}

// ============= Client =============

/**
 * Client v0 Platform API pour les appels directs (côté serveur/edge functions)
 * Côté frontend, les appels passent par les edge functions Supabase
 */
export class V0Client {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || V0_API_CONFIG.baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new V0Error(
        `v0 API Error: ${response.status} - ${errorText}`,
        response.status,
        errorText
      );
    }

    return response.json() as Promise<T>;
  }

  // ---- Chats ----

  async createChat(params: V0ChatCreateParams): Promise<V0ChatResponse> {
    return this.request<V0ChatResponse>('/v1/chats', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createChatStream(params: V0ChatCreateParams): Promise<Response> {
    const url = `${this.baseUrl}/v1/chats`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...params,
        responseMode: 'experimental_stream',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new V0Error(
        `v0 API Stream Error: ${response.status} - ${errorText}`,
        response.status,
        errorText
      );
    }

    return response;
  }

  async sendMessage(params: V0SendMessageParams): Promise<V0ChatResponse> {
    return this.request<V0ChatResponse>(`/v1/chats/${params.chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
      }),
    });
  }

  async sendMessageStream(params: V0SendMessageParams): Promise<Response> {
    const url = `${this.baseUrl}/v1/chats/${params.chatId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        message: params.message,
        responseMode: 'experimental_stream',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new V0Error(
        `v0 API Stream Error: ${response.status} - ${errorText}`,
        response.status,
        errorText
      );
    }

    return response;
  }

  async getChat(chatId: string): Promise<V0ChatResponse> {
    return this.request<V0ChatResponse>(`/v1/chats/${chatId}`);
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.request<void>(`/v1/chats/${chatId}`, { method: 'DELETE' });
  }

  // ---- User & Billing ----

  async getUser(): Promise<Record<string, unknown>> {
    return this.request('/v1/user');
  }

  async getPlan(): Promise<V0UserPlan> {
    return this.request<V0UserPlan>('/v1/user/plan');
  }

  async getBilling(): Promise<Record<string, unknown>> {
    return this.request('/v1/user/billing');
  }

  // ---- Projects ----

  async createProject(name: string, description?: string): Promise<Record<string, unknown>> {
    return this.request('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async getProject(projectId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/projects/${projectId}`);
  }

  async listProjects(): Promise<Record<string, unknown>[]> {
    return this.request('/v1/projects');
  }

  // ---- Rate Limits ----

  async getRateLimits(): Promise<Record<string, unknown>> {
    return this.request('/v1/rate-limits');
  }
}

// ============= Error =============

export class V0Error extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'V0Error';
    this.status = status;
    this.code = code;
  }
}

// ============= Stream Parser =============

/**
 * Parse un flux SSE v0 et émet des événements
 */
export async function* parseV0Stream(response: Response): AsyncGenerator<V0StreamEvent> {
  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentEvent && currentData) {
          try {
            yield {
              event: currentEvent,
              data: JSON.parse(currentData),
            };
          } catch {
            yield {
              event: currentEvent,
              data: currentData,
            };
          }
          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============= Helpers =============

/**
 * Convertit les fichiers v0 (array) vers le format Magellan (Record<string, string>)
 */
export function v0FilesToRecord(files: Array<{ name: string; content: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const file of files) {
    const path = file.name.startsWith('/') ? file.name : `/${file.name}`;
    result[path] = file.content;
  }
  return result;
}

/**
 * Convertit les fichiers Magellan (Record) vers le format v0 (array)
 */
export function recordToV0Files(files: Record<string, string>): Array<{ name: string; content: string }> {
  return Object.entries(files).map(([name, content]) => ({
    name: name.startsWith('/') ? name.slice(1) : name,
    content,
  }));
}
