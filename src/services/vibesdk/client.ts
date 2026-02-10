/**
 * Client VibeSDK - Service d'intégration avec Cloudflare VibeSDK
 * Gère la connexion WebSocket, les sessions, et les événements
 */

import {
  VibeSDKConfig,
  VibeSession,
  BuildOptions,
  FollowUpOptions,
  VibeEvent,
  VibeCallbacks,
  SessionStatus,
  Phase,
  TokenUsage,
  UsageStats,
  DeployResponse,
  StateChangeEvent,
  PhaseEvent,
  FileEvent,
  PreviewEvent,
  DeployEvent,
  ErrorEvent,
  StreamChunkEvent,
  GenerationProgressEvent,
} from './types';

// ============= Constants =============

const DEFAULT_BASE_URL = 'https://build.cloudflare.dev';
const DEFAULT_RETRY_CONFIG = {
  enabled: true,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
};

const WS_RECONNECT_CONFIG = {
  enabled: true,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 10,
};

// ============= VibeSDK Client =============

export class VibeSDKClient {
  private config: Required<VibeSDKConfig>;
  private ws: WebSocket | null = null;
  private session: VibeSession | null = null;
  private callbacks: VibeCallbacks = {};
  private reconnectAttempts = 0;
  private isConnecting = false;
  private messageQueue: any[] = [];
  private usageStats: UsageStats | null = null;

  constructor(config: VibeSDKConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      retryConfig: config.retryConfig || DEFAULT_RETRY_CONFIG,
    };
  }

  // ============= Public API =============

  /**
   * Démarre une nouvelle session de build avec un prompt
   */
  async build(prompt: string, options: BuildOptions = {}): Promise<VibeSessionHandle> {
    console.log('[VibeSDK] Starting build:', { promptLength: prompt.length, options });

    const response = await this.httpRequest('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        projectType: options.projectType || 'app',
        behaviorType: options.behaviorType || 'phasic',
        language: options.language || 'typescript',
        frameworks: options.frameworks || ['react'],
        autoGenerate: options.autoGenerate ?? true,
      }),
    });

    const sessionId = response.sessionId;

    this.session = {
      id: sessionId,
      status: 'initializing',
      files: {},
      phases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Connecter au WebSocket si autoConnect
    if (options.autoConnect !== false) {
      await this.connectWebSocket(sessionId);
    }

    return new VibeSessionHandle(this, sessionId);
  }

  /**
   * Se reconnecte à une session existante
   */
  async connect(sessionId: string): Promise<VibeSessionHandle> {
    console.log('[VibeSDK] Connecting to existing session:', sessionId);

    // Récupérer l'état de la session
    const response = await this.httpRequest(`/api/v1/sessions/${sessionId}`);

    this.session = {
      id: sessionId,
      status: response.status || 'initializing',
      files: response.files || {},
      phases: response.phases || [],
      previewUrl: response.previewUrl,
      deployedUrl: response.deployedUrl,
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(response.updatedAt),
    };

    await this.connectWebSocket(sessionId);

    return new VibeSessionHandle(this, sessionId);
  }

  /**
   * Envoie un message de suivi pour modifier le projet
   */
  async followUp(message: string, options: FollowUpOptions = {}): Promise<void> {
    if (!this.session) {
      throw new Error('No active session. Call build() or connect() first.');
    }

    console.log('[VibeSDK] Sending follow-up:', { messageLength: message.length });

    await this.sendWebSocketMessage({
      type: 'follow_up',
      message,
      attachments: options.attachments,
      context: options.context,
    });
  }

  /**
   * Déploie le projet sur Cloudflare
   */
  async deploy(): Promise<DeployResponse> {
    if (!this.session) {
      throw new Error('No active session');
    }

    console.log('[VibeSDK] Deploying project');

    const response = await this.httpRequest(`/api/v1/sessions/${this.session.id}/deploy`, {
      method: 'POST',
    });

    if (response.url) {
      this.session.deployedUrl = response.url;
      this.session.status = 'deployed';
    }

    return response;
  }

  /**
   * Récupère les fichiers du projet
   */
  async getFiles(): Promise<Record<string, string>> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const response = await this.httpRequest(`/api/v1/sessions/${this.session.id}/files`);
    this.session.files = response.files || {};

    return this.session.files;
  }

  /**
   * Récupère l'URL de preview
   */
  getPreviewUrl(): string | undefined {
    return this.session?.previewUrl;
  }

  /**
   * Récupère l'état actuel de la session
   */
  getState(): VibeSession | null {
    return this.session;
  }

  /**
   * Récupère les statistiques d'utilisation
   */
  getUsageStats(): UsageStats | null {
    return this.usageStats;
  }

  /**
   * Arrête la génération en cours
   */
  async stop(): Promise<void> {
    if (!this.session) return;

    console.log('[VibeSDK] Stopping generation');

    await this.sendWebSocketMessage({
      type: 'stop',
    });
  }

  /**
   * Reprend la génération
   */
  async resume(): Promise<void> {
    if (!this.session) return;

    console.log('[VibeSDK] Resuming generation');

    await this.sendWebSocketMessage({
      type: 'resume',
    });
  }

  /**
   * Ferme la session et déconnecte
   */
  close(): void {
    console.log('[VibeSDK] Closing session');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.session = null;
    this.callbacks = {};
    this.reconnectAttempts = 0;
  }

  // ============= Callbacks =============

  /**
   * Enregistre les callbacks pour les événements
   */
  on(callbacks: VibeCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Supprime un callback spécifique
   */
  off(eventType: keyof VibeCallbacks): void {
    delete this.callbacks[eventType];
  }

  // ============= WebSocket Management =============

  private async connectWebSocket(sessionId: string): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const wsUrl = this.config.baseUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    const url = `${wsUrl}/api/v1/sessions/${sessionId}/ws`;

    console.log('[VibeSDK] Connecting WebSocket');

    return new Promise((resolve, reject) => {
      // Passer le token via le sous-protocole WebSocket pour éviter de l'exposer dans l'URL
      this.ws = new WebSocket(url, [`bearer-${this.config.apiKey}`]);

      this.ws.onopen = () => {
        console.log('[VibeSDK] WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Envoyer les messages en attente
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws?.send(JSON.stringify(msg));
        }

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('[VibeSDK] Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[VibeSDK] WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log('[VibeSDK] WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;

        // Tenter une reconnexion si nécessaire
        if (WS_RECONNECT_CONFIG.enabled && this.reconnectAttempts < WS_RECONNECT_CONFIG.maxRetries) {
          this.attemptReconnect(sessionId);
        }
      };

      // Timeout de connexion
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  private attemptReconnect(sessionId: string): void {
    const delay = Math.min(
      WS_RECONNECT_CONFIG.initialDelayMs * Math.pow(2, this.reconnectAttempts),
      WS_RECONNECT_CONFIG.maxDelayMs
    );

    console.log(`[VibeSDK] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connectWebSocket(sessionId).catch(console.error);
    }, delay);
  }

  private async sendWebSocketMessage(message: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[VibeSDK] WebSocket not ready, queueing message');
      this.messageQueue.push(message);
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  private handleWebSocketMessage(data: any): void {
    console.log('[VibeSDK] Received message:', data.type);

    const event = this.parseEvent(data);
    if (!event) return;

    // Mettre à jour l'état de la session
    this.updateSessionFromEvent(event);

    // Appeler le callback approprié
    this.dispatchEvent(event);
  }

  private parseEvent(data: any): VibeEvent | null {
    const timestamp = new Date();

    switch (data.type) {
      case 'state_change':
        return {
          type: 'state_change',
          timestamp,
          data: {
            previousStatus: data.previousStatus,
            newStatus: data.newStatus,
          },
        } as StateChangeEvent;

      case 'phase_start':
      case 'phase_complete':
      case 'phase_error':
        return {
          type: data.type,
          timestamp,
          data: {
            phase: data.phase,
            message: data.message,
          },
        } as PhaseEvent;

      case 'file_created':
      case 'file_modified':
      case 'file_deleted':
        return {
          type: data.type,
          timestamp,
          data: {
            path: data.path,
            content: data.content,
          },
        } as FileEvent;

      case 'preview_ready':
        return {
          type: 'preview_ready',
          timestamp,
          data: {
            url: data.url,
          },
        } as PreviewEvent;

      case 'deploy_ready':
      case 'deploy_complete':
        return {
          type: data.type,
          timestamp,
          data: {
            url: data.url,
          },
        } as DeployEvent;

      case 'error':
        return {
          type: 'error',
          timestamp,
          data: {
            message: data.message,
            code: data.code,
            details: data.details,
          },
        } as ErrorEvent;

      case 'stream':
      case 'chunk':
        return {
          type: 'stream_chunk',
          timestamp,
          data: {
            content: data.content,
            phase: data.phase,
          },
        } as StreamChunkEvent;

      case 'progress':
        return {
          type: 'generation_progress',
          timestamp,
          data: {
            progress: data.progress,
            message: data.message,
            phase: data.phase,
          },
        } as GenerationProgressEvent;

      case 'tokens':
      case 'usage':
        this.usageStats = {
          tokens: {
            input: data.input || data.tokens?.input || 0,
            output: data.output || data.tokens?.output || 0,
            total: data.total || data.tokens?.total || 0,
          },
          duration: data.duration || 0,
          phases: this.session?.phases.length || 0,
        };
        return null;

      default:
        console.log('[VibeSDK] Unknown event type:', data.type);
        return null;
    }
  }

  private updateSessionFromEvent(event: VibeEvent): void {
    if (!this.session) return;

    switch (event.type) {
      case 'state_change':
        const stateEvent = event as StateChangeEvent;
        this.session.status = stateEvent.data.newStatus;
        break;

      case 'phase_start':
        const phaseStartEvent = event as PhaseEvent;
        this.session.currentPhase = phaseStartEvent.data.phase;
        if (!this.session.phases.find(p => p.id === phaseStartEvent.data.phase.id)) {
          this.session.phases.push(phaseStartEvent.data.phase);
        }
        break;

      case 'phase_complete':
        const phaseCompleteEvent = event as PhaseEvent;
        const completedPhase = this.session.phases.find(
          p => p.id === phaseCompleteEvent.data.phase.id
        );
        if (completedPhase) {
          completedPhase.status = 'completed';
          completedPhase.completedAt = new Date();
        }
        break;

      case 'file_created':
      case 'file_modified':
        const fileEvent = event as FileEvent;
        if (fileEvent.data.content !== undefined) {
          this.session.files[fileEvent.data.path] = fileEvent.data.content;
        }
        break;

      case 'file_deleted':
        const deleteEvent = event as FileEvent;
        delete this.session.files[deleteEvent.data.path];
        break;

      case 'preview_ready':
        const previewEvent = event as PreviewEvent;
        this.session.previewUrl = previewEvent.data.url;
        break;

      case 'deploy_complete':
        const deployEvent = event as DeployEvent;
        if (deployEvent.data.url) {
          this.session.deployedUrl = deployEvent.data.url;
          this.session.status = 'deployed';
        }
        break;
    }

    this.session.updatedAt = new Date();
  }

  private dispatchEvent(event: VibeEvent): void {
    switch (event.type) {
      case 'state_change':
        this.callbacks.onStateChange?.(event as StateChangeEvent);
        break;
      case 'phase_start':
        this.callbacks.onPhaseStart?.(event as PhaseEvent);
        break;
      case 'phase_complete':
        this.callbacks.onPhaseComplete?.(event as PhaseEvent);
        break;
      case 'phase_error':
        this.callbacks.onPhaseError?.(event as PhaseEvent);
        break;
      case 'file_created':
        this.callbacks.onFileCreated?.(event as FileEvent);
        break;
      case 'file_modified':
        this.callbacks.onFileModified?.(event as FileEvent);
        break;
      case 'file_deleted':
        this.callbacks.onFileDeleted?.(event as FileEvent);
        break;
      case 'preview_ready':
        this.callbacks.onPreviewReady?.(event as PreviewEvent);
        break;
      case 'deploy_ready':
        this.callbacks.onDeployReady?.(event as DeployEvent);
        break;
      case 'deploy_complete':
        this.callbacks.onDeployComplete?.(event as DeployEvent);
        break;
      case 'error':
        this.callbacks.onError?.(event as ErrorEvent);
        break;
      case 'stream_chunk':
        this.callbacks.onStreamChunk?.(event as StreamChunkEvent);
        break;
      case 'generation_progress':
        this.callbacks.onGenerationProgress?.(event as GenerationProgressEvent);
        break;
    }
  }

  // ============= HTTP Requests =============

  private async httpRequest(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...(options.headers || {}),
    };

    let lastError: Error | null = null;
    const maxRetries = this.config.retryConfig.enabled ? this.config.retryConfig.maxRetries : 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.min(
            this.config.retryConfig.initialDelayMs * Math.pow(2, attempt),
            this.config.retryConfig.maxDelayMs
          );
          console.log(`[VibeSDK] Retrying request in ${delay}ms (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

// ============= Session Handle =============

/**
 * Handle pour interagir avec une session active
 */
export class VibeSessionHandle {
  private client: VibeSDKClient;
  readonly id: string;

  constructor(client: VibeSDKClient, sessionId: string) {
    this.client = client;
    this.id = sessionId;
  }

  /**
   * Attend que la session atteigne un certain status
   */
  get wait() {
    return {
      deployable: () => this.waitForStatus('deployable'),
      deployed: () => this.waitForStatus('deployed'),
      planning: () => this.waitForStatus('planning'),
      coding: () => this.waitForStatus('coding'),
    };
  }

  /**
   * Accès aux fichiers
   */
  get files() {
    const state = this.client.getState();
    return {
      listPaths: () => Object.keys(state?.files || {}),
      read: (path: string) => state?.files[path],
      snapshot: () => ({ ...state?.files }) || {},
    };
  }

  /**
   * Accès aux phases
   */
  get phases() {
    const state = this.client.getState();
    return {
      list: () => [...(state?.phases || [])],
      current: () => state?.currentPhase,
      onChange: (callback: (event: PhaseEvent) => void) => {
        this.client.on({
          onPhaseStart: callback,
          onPhaseComplete: callback,
          onPhaseError: callback,
        });
      },
    };
  }

  /**
   * Accès à l'état
   */
  get state() {
    const state = this.client.getState();
    return {
      get: () => state,
      status: state?.status,
      previewUrl: state?.previewUrl,
      deployedUrl: state?.deployedUrl,
      onChange: (callback: (next: VibeSession | null, prev: VibeSession | null) => void) => {
        let prevState = state;
        this.client.on({
          onStateChange: () => {
            const newState = this.client.getState();
            callback(newState, prevState);
            prevState = newState;
          },
        });
      },
    };
  }

  /**
   * Envoie un message de suivi
   */
  followUp(message: string, options?: FollowUpOptions): Promise<void> {
    return this.client.followUp(message, options);
  }

  /**
   * Déploie la preview
   */
  async deployPreview(): Promise<void> {
    // La preview est automatiquement déployée par VibeSDK
    console.log('[VibeSDK] Preview deployment requested');
  }

  /**
   * Déploie sur Cloudflare
   */
  deployCloudflare(): Promise<DeployResponse> {
    return this.client.deploy();
  }

  /**
   * Arrête la génération
   */
  stop(): Promise<void> {
    return this.client.stop();
  }

  /**
   * Reprend la génération
   */
  resume(): Promise<void> {
    return this.client.resume();
  }

  /**
   * Ferme la session
   */
  close(): void {
    this.client.close();
  }

  /**
   * Enregistre des callbacks
   */
  on(callbacks: VibeCallbacks): void {
    this.client.on(callbacks);
  }

  private waitForStatus(targetStatus: SessionStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const state = this.client.getState();
        if (state?.status === targetStatus) {
          resolve();
          return true;
        }
        if (state?.status === 'error') {
          reject(new Error(state.error || 'Session error'));
          return true;
        }
        return false;
      };

      // Vérifier immédiatement
      if (checkStatus()) return;

      // Sinon, écouter les changements d'état
      this.client.on({
        onStateChange: (event) => {
          if (event.data.newStatus === targetStatus) {
            resolve();
          } else if (event.data.newStatus === 'error') {
            reject(new Error('Session error'));
          }
        },
        onError: (event) => {
          reject(new Error(event.data.message));
        },
      });

      // Timeout de sécurité (10 minutes)
      setTimeout(() => {
        reject(new Error(`Timeout waiting for status: ${targetStatus}`));
      }, 600000);
    });
  }
}

// ============= Factory Functions =============

/**
 * Crée un client VibeSDK avec le type 'phasic' (génération par phases)
 */
export function createPhasicClient(config: VibeSDKConfig): VibeSDKClient {
  return new VibeSDKClient(config);
}

/**
 * Crée un client VibeSDK avec le type 'agentic' (agent autonome)
 */
export function createAgenticClient(config: VibeSDKConfig): VibeSDKClient {
  return new VibeSDKClient(config);
}

// Export default
export default VibeSDKClient;
