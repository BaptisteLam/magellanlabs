/**
 * Cloudflare VibeSDK Client
 * Wrapper pour l'API VibeSDK de Cloudflare pour la génération de sites
 * Remplace l'ancien client V0 de Vercel
 *
 * Côté frontend, les appels passent par les edge functions Supabase.
 * Ce fichier fournit les types et helpers pour le frontend.
 */

import { VIBESDK_CONFIG } from '@/config/constants';

// ============= Types =============

export interface VibeSDKBuildParams {
  prompt: string;
  projectType?: 'app' | 'website';
  autoGenerate?: boolean;
  sessionId?: string;
}

export interface VibeSDKFollowUpParams {
  agentId: string;
  message: string;
  sessionId?: string;
}

export interface VibeSDKPhaseFile {
  path: string;
  content: string;
  status: 'pending' | 'generating' | 'completed' | 'cancelled';
}

export interface VibeSDKPhaseInfo {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'skipped';
  files: VibeSDKPhaseFile[];
}

export interface VibeSDKSessionState {
  agentId: string;
  previewUrl?: string;
  deployedUrl?: string;
  files: Record<string, string>;
  phases: VibeSDKPhaseInfo[];
  status: 'building' | 'ready' | 'deployed' | 'error';
}

export interface VibeSDKStreamEvent {
  event: string;
  data: unknown;
}

export interface VibeSDKUserPlan {
  plan: string;
  messagesRemaining: number;
  messagesTotal: number;
  resetDate: string;
}

// ============= Client (pour edge functions côté serveur) =============

/**
 * Client VibeSDK pour les appels directs (côté serveur/edge functions)
 * Utilise l'API REST de VibeSDK
 */
export class VibeSDKClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || VIBESDK_CONFIG.baseUrl;
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
      throw new VibeSDKError(
        `VibeSDK API Error: ${response.status} - ${errorText}`,
        response.status,
        errorText
      );
    }

    return response.json() as Promise<T>;
  }

  // ---- Build ----

  /**
   * Lance une nouvelle génération de site via VibeSDK
   * Retourne les infos de la session (agentId, websocketUrl, etc.)
   */
  async build(params: VibeSDKBuildParams): Promise<Record<string, unknown>> {
    return this.request('/api/agent', {
      method: 'POST',
      body: JSON.stringify({
        query: params.prompt,
        projectType: params.projectType || VIBESDK_CONFIG.defaultProjectType,
        behaviorType: VIBESDK_CONFIG.defaultBehaviorType,
      }),
    });
  }

  /**
   * Envoie un message de suivi à un agent existant
   */
  async followUp(agentId: string, message: string): Promise<Record<string, unknown>> {
    return this.request(`/api/agent/${agentId}/message`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        type: 'user_suggestion',
      }),
    });
  }

  /**
   * Récupère l'état courant d'un agent/session
   */
  async getAgentState(agentId: string): Promise<Record<string, unknown>> {
    return this.request(`/api/agent/${agentId}/status`);
  }

  /**
   * Récupère les fichiers générés d'un agent
   */
  async getFiles(agentId: string): Promise<Record<string, string>> {
    const response = await this.request<{ files: Record<string, string> }>(`/api/agent/${agentId}/files`);
    return response.files || {};
  }

  /**
   * Déclenche le déploiement preview
   */
  async deployPreview(agentId: string): Promise<Record<string, unknown>> {
    return this.request(`/api/agent/${agentId}/deploy/preview`, {
      method: 'POST',
    });
  }

  // ---- Apps ----

  async listApps(): Promise<Record<string, unknown>[]> {
    const response = await this.request<{ data: Record<string, unknown>[] }>('/api/apps/mine');
    return response.data || [];
  }

  async getApp(appId: string): Promise<Record<string, unknown>> {
    return this.request(`/api/apps/${appId}`);
  }

  async deleteApp(appId: string): Promise<void> {
    await this.request(`/api/apps/${appId}`, { method: 'DELETE' });
  }
}

// ============= Error =============

export class VibeSDKError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'VibeSDKError';
    this.status = status;
    this.code = code;
  }
}

// ============= Stream Parser =============

/**
 * Parse un flux SSE VibeSDK et émet des événements
 */
export async function* parseVibeSDKStream(response: Response): AsyncGenerator<VibeSDKStreamEvent> {
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
 * Convertit les fichiers VibeSDK (array) vers le format Magellan (Record<string, string>)
 */
export function vibeSDKFilesToRecord(files: Array<{ path: string; content: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const file of files) {
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;
    result[path] = file.content;
  }
  return result;
}

/**
 * Convertit les fichiers Magellan (Record) vers le format VibeSDK (array)
 */
export function recordToVibeSDKFiles(files: Record<string, string>): Array<{ path: string; content: string }> {
  return Object.entries(files).map(([path, content]) => ({
    path: path.startsWith('/') ? path.slice(1) : path,
    content,
  }));
}
