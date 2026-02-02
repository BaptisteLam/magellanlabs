/**
 * VibeSDK Service - Intégration complète avec l'application Magellan
 * Gère la connexion VibeSDK, la synchronisation avec Supabase, et le tracking d'usage
 */

import { supabase } from '@/integrations/supabase/client';
import {
  VibeSDKClient,
  VibeSessionHandle,
  createPhasicClient,
} from './client';
import {
  VibeSDKConfig,
  BuildOptions,
  FollowUpOptions,
  VibeCallbacks,
  VibeSession,
  SessionStatus,
  TokenUsage,
  UsageStats,
  mapVibeEventToLegacy,
  VibeEvent,
  FileEvent,
  PhaseEvent,
  ErrorEvent,
  PreviewEvent,
  DeployEvent,
  GenerationProgressEvent,
  StreamChunkEvent,
} from './types';
import type { GenerationEvent } from '@/types/agent';

// ============= Configuration =============

const VIBESDK_API_KEY = import.meta.env.VITE_VIBESDK_API_KEY || '';
const VIBESDK_BASE_URL = import.meta.env.VITE_VIBESDK_BASE_URL || 'https://build.cloudflare.dev';

// ============= Types =============

export interface MagellanBuildOptions extends BuildOptions {
  sessionId: string;
  userId?: string;
  prompt: string;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
}

export interface MagellanModifyOptions extends FollowUpOptions {
  sessionId: string;
  projectFiles: Record<string, string>;
  message: string;
  memory?: any;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface LegacyGenerationCallbacks {
  onProgress?: (content: string) => void;
  onFiles?: (files: Record<string, string>) => void;
  onTokens?: (tokens: { input: number; output: number; total: number }) => void;
  onError?: (error: string) => void;
  onComplete?: (result: any) => void;
  onGenerationEvent?: (event: GenerationEvent) => void;
  onProjectName?: (name: string) => void;
}

export interface LegacyModifyCallbacks {
  onIntentMessage?: (message: string) => void;
  onGenerationEvent?: (event: any) => void;
  onFileModified?: (file: string, description: string) => void;
  onASTModifications?: (modifications: any[], updatedFiles: Record<string, string>) => Promise<void>;
  onTokens?: (tokens: TokenUsage) => void;
  onError?: (error: string) => void;
  onComplete?: (result: any) => void;
}

// ============= VibeSDK Service =============

export class VibeSDKService {
  private client: VibeSDKClient | null = null;
  private currentSession: VibeSessionHandle | null = null;
  private config: VibeSDKConfig;
  private isInitialized = false;

  constructor(apiKey?: string, baseUrl?: string) {
    this.config = {
      apiKey: apiKey || VIBESDK_API_KEY,
      baseUrl: baseUrl || VIBESDK_BASE_URL,
      retryConfig: {
        enabled: true,
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      },
    };
  }

  /**
   * Initialise le service avec une clé API
   */
  initialize(apiKey?: string): void {
    if (apiKey) {
      this.config.apiKey = apiKey;
    }

    if (!this.config.apiKey) {
      console.warn('[VibeSDKService] No API key configured');
      return;
    }

    this.client = createPhasicClient(this.config);
    this.isInitialized = true;
    console.log('[VibeSDKService] Initialized');
  }

  /**
   * Vérifie si le service est initialisé
   */
  isReady(): boolean {
    return this.isInitialized && !!this.client;
  }

  // ============= Génération de Sites =============

  /**
   * Génère un nouveau site via VibeSDK (remplace useGenerateSite)
   * Compatible avec l'interface legacy pour une migration en douceur
   */
  async generateSite(
    options: MagellanBuildOptions,
    callbacks: LegacyGenerationCallbacks = {}
  ): Promise<{ success: boolean; files: Record<string, string>; tokens: TokenUsage; duration: number } | null> {
    if (!this.client) {
      this.initialize();
      if (!this.client) {
        callbacks.onError?.('VibeSDK not initialized');
        return null;
      }
    }

    const { sessionId, prompt, attachedFiles, projectType } = options;
    const startTime = Date.now();

    try {
      // Émettre l'événement d'analyse initial
      callbacks.onGenerationEvent?.({
        type: 'analyze',
        message: 'Analyse de votre demande...',
        status: 'in-progress',
      });

      // Préparer les attachments pour VibeSDK
      const vibeAttachments = attachedFiles?.map(file => ({
        name: file.name,
        content: file.base64,
        type: 'image' as const,
        mimeType: file.type,
      }));

      // Configurer les callbacks VibeSDK
      this.client.on(this.createVibeCallbacks(callbacks));

      // Démarrer le build
      this.currentSession = await this.client.build(prompt, {
        projectType: this.mapProjectType(projectType || 'website'),
        behaviorType: 'phasic',
        frameworks: this.getFrameworksForType(projectType || 'website'),
        autoConnect: true,
        autoGenerate: true,
      });

      // Attendre que le projet soit déployable
      await this.currentSession.wait.deployable();

      // Récupérer les fichiers générés
      const files = this.currentSession.files.snapshot();
      const usageStats = this.client.getUsageStats();

      // Mettre à jour Supabase avec les fichiers générés
      await this.syncFilesToSupabase(sessionId, files);

      // Émettre l'événement de complétion
      callbacks.onGenerationEvent?.({
        type: 'complete',
        message: 'Site généré avec succès!',
        status: 'completed',
      });

      // Notifier les fichiers créés
      Object.keys(files).forEach(path => {
        callbacks.onGenerationEvent?.({
          type: 'create',
          file: path,
          message: `Fichier créé: ${path}`,
          status: 'completed',
        });
      });

      callbacks.onFiles?.(files);

      const result = {
        success: true,
        files,
        tokens: usageStats?.tokens || { input: 0, output: 0, total: 0 },
        duration: Date.now() - startTime,
      };

      callbacks.onTokens?.(result.tokens);
      callbacks.onComplete?.(result);

      // Mettre à jour les quotas utilisateur
      await this.updateUserQuotas(result.tokens);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[VibeSDKService] Generation error:', errorMessage);
      callbacks.onError?.(errorMessage);
      return null;
    }
  }

  /**
   * Modifie un site existant via VibeSDK (remplace useUnifiedModify)
   * Compatible avec l'interface legacy pour une migration en douceur
   */
  async modifySite(
    options: MagellanModifyOptions,
    callbacks: LegacyModifyCallbacks = {}
  ): Promise<any | null> {
    if (!this.client) {
      this.initialize();
      if (!this.client) {
        callbacks.onError?.('VibeSDK not initialized');
        return null;
      }
    }

    const { sessionId, projectFiles, message, memory, conversationHistory } = options;
    const startTime = Date.now();

    try {
      // Si pas de session active, en créer une nouvelle avec les fichiers existants
      if (!this.currentSession || this.currentSession.id !== sessionId) {
        // Récupérer ou créer une session VibeSDK
        this.currentSession = await this.getOrCreateVibeSession(sessionId, projectFiles);
      }

      // Émettre l'événement d'analyse
      callbacks.onGenerationEvent?.({
        type: 'phase',
        phase: 'analyze',
        status: 'starting',
        message: 'Analyse de la demande...',
      });

      // Configurer les callbacks pour les modifications
      this.client.on(this.createModifyCallbacks(callbacks));

      // Envoyer le message de modification
      await this.currentSession.followUp(message, {
        context: this.buildContext(memory, conversationHistory),
      });

      // Attendre que les modifications soient appliquées
      await this.currentSession.wait.deployable();

      // Récupérer les fichiers mis à jour
      const updatedFiles = this.currentSession.files.snapshot();
      const usageStats = this.client.getUsageStats();

      // Détecter les modifications
      const modifications = this.detectModifications(projectFiles, updatedFiles);

      // Sync avec Supabase
      await this.syncFilesToSupabase(sessionId, updatedFiles);

      // Émettre l'événement de complétion
      callbacks.onGenerationEvent?.({
        type: 'phase',
        phase: 'complete',
        status: 'complete',
        message: 'Modifications appliquées',
      });

      const result = {
        success: true,
        modifications,
        updatedFiles,
        message: 'Modifications appliquées avec succès',
        tokens: usageStats?.tokens || { input: 0, output: 0, total: 0 },
        duration: Date.now() - startTime,
        analysis: {
          complexity: 'moderate' as const,
          intentType: 'quick-modification' as const,
          confidence: 85,
          explanation: 'Modification via VibeSDK',
        },
      };

      // Appeler les callbacks
      if (modifications.length > 0) {
        await callbacks.onASTModifications?.(modifications, updatedFiles);
      }
      callbacks.onTokens?.(result.tokens);
      callbacks.onComplete?.(result);

      // Mettre à jour les quotas
      await this.updateUserQuotas(result.tokens);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[VibeSDKService] Modification error:', errorMessage);
      callbacks.onError?.(errorMessage);
      return null;
    }
  }

  // ============= Preview & Déploiement =============

  /**
   * Récupère l'URL de preview du projet actuel
   */
  getPreviewUrl(): string | undefined {
    return this.currentSession?.state.previewUrl;
  }

  /**
   * Déploie le projet sur Cloudflare
   */
  async deployToCloudflare(sessionId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const result = await this.currentSession.deployCloudflare();

      // Mettre à jour Supabase avec l'URL de déploiement
      if (result.url) {
        await supabase
          .from('build_sessions')
          .update({
            cloudflare_deployment_url: result.url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deploy failed',
      };
    }
  }

  // ============= Session Management =============

  /**
   * Récupère l'état actuel de la session
   */
  getSessionState(): VibeSession | null {
    return this.client?.getState() || null;
  }

  /**
   * Arrête la génération en cours
   */
  async stopGeneration(): Promise<void> {
    await this.currentSession?.stop();
  }

  /**
   * Reprend la génération
   */
  async resumeGeneration(): Promise<void> {
    await this.currentSession?.resume();
  }

  /**
   * Ferme la session actuelle
   */
  closeSession(): void {
    this.currentSession?.close();
    this.currentSession = null;
  }

  // ============= Helper Methods =============

  private createVibeCallbacks(legacyCallbacks: LegacyGenerationCallbacks): VibeCallbacks {
    return {
      onPhaseStart: (event: PhaseEvent) => {
        const legacyEvent = mapVibeEventToLegacy(event);
        legacyCallbacks.onGenerationEvent?.(legacyEvent);
      },
      onPhaseComplete: (event: PhaseEvent) => {
        const legacyEvent = mapVibeEventToLegacy(event);
        legacyCallbacks.onGenerationEvent?.(legacyEvent);
      },
      onFileCreated: (event: FileEvent) => {
        const legacyEvent = mapVibeEventToLegacy(event);
        legacyCallbacks.onGenerationEvent?.(legacyEvent);
      },
      onFileModified: (event: FileEvent) => {
        const legacyEvent = mapVibeEventToLegacy(event);
        legacyCallbacks.onGenerationEvent?.(legacyEvent);
      },
      onStreamChunk: (event: StreamChunkEvent) => {
        legacyCallbacks.onProgress?.(event.data.content);
      },
      onError: (event: ErrorEvent) => {
        legacyCallbacks.onError?.(event.data.message);
      },
      onPreviewReady: (event: PreviewEvent) => {
        console.log('[VibeSDKService] Preview ready:', event.data.url);
      },
    };
  }

  private createModifyCallbacks(legacyCallbacks: LegacyModifyCallbacks): VibeCallbacks {
    return {
      onPhaseStart: (event: PhaseEvent) => {
        legacyCallbacks.onGenerationEvent?.({
          type: 'phase',
          phase: event.data.phase.name,
          status: 'starting',
          message: event.data.message,
        });
      },
      onPhaseComplete: (event: PhaseEvent) => {
        legacyCallbacks.onGenerationEvent?.({
          type: 'phase',
          phase: event.data.phase.name,
          status: 'complete',
          message: event.data.message,
        });
      },
      onFileModified: (event: FileEvent) => {
        legacyCallbacks.onFileModified?.(event.data.path, 'Modified via VibeSDK');
        legacyCallbacks.onGenerationEvent?.({
          type: 'file_modified',
          file: event.data.path,
          description: 'Modified',
        });
      },
      onError: (event: ErrorEvent) => {
        legacyCallbacks.onError?.(event.data.message);
      },
    };
  }

  private async getOrCreateVibeSession(
    sessionId: string,
    projectFiles: Record<string, string>
  ): Promise<VibeSessionHandle> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Créer une nouvelle session avec les fichiers existants comme contexte
    const filesContext = Object.entries(projectFiles)
      .map(([path, content]) => `// File: ${path}\n${content}`)
      .join('\n\n');

    const session = await this.client.build(
      `Continue working on this existing project. Here are the current files:\n\n${filesContext}`,
      {
        projectType: 'app',
        behaviorType: 'phasic',
        autoConnect: true,
        autoGenerate: false, // Ne pas générer automatiquement, attendre le follow-up
      }
    );

    return session;
  }

  private mapProjectType(type: string): 'app' | 'component' | 'api' {
    switch (type) {
      case 'website':
      case 'webapp':
        return 'app';
      case 'mobile':
        return 'app';
      default:
        return 'app';
    }
  }

  private getFrameworksForType(type: string): string[] {
    switch (type) {
      case 'website':
        return ['html', 'css', 'javascript'];
      case 'webapp':
        return ['react', 'typescript'];
      case 'mobile':
        return ['react-native'];
      default:
        return ['react'];
    }
  }

  private buildContext(memory?: any, conversationHistory?: Array<{ role: string; content: string }>): string {
    const parts: string[] = [];

    if (memory?.architecture) {
      parts.push(`Architecture: ${JSON.stringify(memory.architecture)}`);
    }

    if (memory?.recent_changes?.length) {
      parts.push(`Recent changes: ${memory.recent_changes.map((c: any) => c.description).join(', ')}`);
    }

    if (conversationHistory?.length) {
      const recentMessages = conversationHistory.slice(-5);
      parts.push(`Conversation context: ${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  private detectModifications(
    originalFiles: Record<string, string>,
    updatedFiles: Record<string, string>
  ): any[] {
    const modifications: any[] = [];

    // Fichiers modifiés ou créés
    for (const [path, content] of Object.entries(updatedFiles)) {
      if (!originalFiles[path]) {
        modifications.push({
          type: 'file-create',
          path,
          changeType: 'created',
        });
      } else if (originalFiles[path] !== content) {
        modifications.push({
          type: 'file-modify',
          path,
          changeType: 'modified',
        });
      }
    }

    // Fichiers supprimés
    for (const path of Object.keys(originalFiles)) {
      if (!updatedFiles[path]) {
        modifications.push({
          type: 'file-delete',
          path,
          changeType: 'deleted',
        });
      }
    }

    return modifications;
  }

  private async syncFilesToSupabase(sessionId: string, files: Record<string, string>): Promise<void> {
    try {
      await supabase
        .from('build_sessions')
        .update({
          project_files: files,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      console.log('[VibeSDKService] Files synced to Supabase');
    } catch (error) {
      console.error('[VibeSDKService] Failed to sync files:', error);
    }
  }

  private async updateUserQuotas(tokens: TokenUsage): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer le profil actuel
      const { data: profile } = await supabase
        .from('profiles')
        .select('tokens_used')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        // Mettre à jour les tokens utilisés
        await supabase
          .from('profiles')
          .update({
            tokens_used: (profile.tokens_used || 0) + tokens.total,
          })
          .eq('id', user.id);

        console.log('[VibeSDKService] User quotas updated');
      }
    } catch (error) {
      console.error('[VibeSDKService] Failed to update quotas:', error);
    }
  }
}

// ============= Singleton Instance =============

export const vibeSDKService = new VibeSDKService();

export default VibeSDKService;
