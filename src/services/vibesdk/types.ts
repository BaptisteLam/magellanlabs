/**
 * Types pour l'intégration Cloudflare VibeSDK
 * @see https://github.com/cloudflare/vibesdk
 */

// ============= Configuration =============

export interface VibeSDKConfig {
  apiKey: string;
  baseUrl?: string;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

// ============= Session & State =============

export type ProjectType = 'app' | 'component' | 'api';
export type BehaviorType = 'phasic' | 'agentic';
export type SessionStatus = 'initializing' | 'planning' | 'coding' | 'debugging' | 'deployable' | 'deployed' | 'error';

export interface VibeSession {
  id: string;
  status: SessionStatus;
  previewUrl?: string;
  deployedUrl?: string;
  files: Record<string, string>;
  phases: Phase[];
  currentPhase?: Phase;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Phase {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// ============= Build Options =============

export interface BuildOptions {
  projectType?: ProjectType;
  behaviorType?: BehaviorType;
  language?: string;
  frameworks?: string[];
  autoConnect?: boolean;
  autoGenerate?: boolean;
}

export interface FollowUpOptions {
  attachments?: Attachment[];
  context?: string;
}

export interface Attachment {
  name: string;
  content: string;
  type: 'image' | 'file' | 'code';
  mimeType?: string;
}

// ============= Events =============

export type VibeEventType =
  | 'state_change'
  | 'phase_start'
  | 'phase_complete'
  | 'phase_error'
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'preview_ready'
  | 'deploy_ready'
  | 'deploy_complete'
  | 'error'
  | 'stream_chunk'
  | 'generation_progress';

export interface VibeEvent {
  type: VibeEventType;
  timestamp: Date;
  data: any;
}

export interface StateChangeEvent extends VibeEvent {
  type: 'state_change';
  data: {
    previousStatus: SessionStatus;
    newStatus: SessionStatus;
  };
}

export interface PhaseEvent extends VibeEvent {
  type: 'phase_start' | 'phase_complete' | 'phase_error';
  data: {
    phase: Phase;
    message?: string;
  };
}

export interface FileEvent extends VibeEvent {
  type: 'file_created' | 'file_modified' | 'file_deleted';
  data: {
    path: string;
    content?: string;
  };
}

export interface PreviewEvent extends VibeEvent {
  type: 'preview_ready';
  data: {
    url: string;
  };
}

export interface DeployEvent extends VibeEvent {
  type: 'deploy_ready' | 'deploy_complete';
  data: {
    url?: string;
  };
}

export interface ErrorEvent extends VibeEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
    details?: any;
  };
}

export interface StreamChunkEvent extends VibeEvent {
  type: 'stream_chunk';
  data: {
    content: string;
    phase?: string;
  };
}

export interface GenerationProgressEvent extends VibeEvent {
  type: 'generation_progress';
  data: {
    progress: number;
    message: string;
    phase?: string;
  };
}

// ============= API Responses =============

export interface BuildResponse {
  sessionId: string;
  status: SessionStatus;
}

export interface DeployResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export interface FilesResponse {
  files: Record<string, string>;
}

// ============= Callbacks =============

export interface VibeCallbacks {
  onStateChange?: (event: StateChangeEvent) => void;
  onPhaseStart?: (event: PhaseEvent) => void;
  onPhaseComplete?: (event: PhaseEvent) => void;
  onPhaseError?: (event: PhaseEvent) => void;
  onFileCreated?: (event: FileEvent) => void;
  onFileModified?: (event: FileEvent) => void;
  onFileDeleted?: (event: FileEvent) => void;
  onPreviewReady?: (event: PreviewEvent) => void;
  onDeployReady?: (event: DeployEvent) => void;
  onDeployComplete?: (event: DeployEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onStreamChunk?: (event: StreamChunkEvent) => void;
  onGenerationProgress?: (event: GenerationProgressEvent) => void;
}

// ============= Tokens & Usage =============

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface UsageStats {
  tokens: TokenUsage;
  duration: number;
  phases: number;
}

// ============= Mapping to existing types =============

export interface GenerationEventMapping {
  vibeEventType: VibeEventType;
  legacyEventType: 'analyze' | 'thought' | 'create' | 'file_modified' | 'complete';
}

// Convertir les événements VibeSDK vers le format legacy pour compatibilité
export function mapVibeEventToLegacy(event: VibeEvent): {
  type: string;
  message: string;
  file?: string;
  status: 'in-progress' | 'completed';
} {
  switch (event.type) {
    case 'phase_start':
      const phaseStart = event as PhaseEvent;
      return {
        type: phaseStart.data.phase.name === 'planning' ? 'analyze' : 'thought',
        message: phaseStart.data.message || `Phase ${phaseStart.data.phase.name} démarrée`,
        status: 'in-progress'
      };

    case 'phase_complete':
      const phaseComplete = event as PhaseEvent;
      return {
        type: phaseComplete.data.phase.name === 'planning' ? 'analyze' : 'thought',
        message: phaseComplete.data.message || `Phase ${phaseComplete.data.phase.name} terminée`,
        status: 'completed'
      };

    case 'file_created':
    case 'file_modified':
      const fileEvent = event as FileEvent;
      return {
        type: event.type === 'file_created' ? 'create' : 'file_modified',
        message: `Fichier ${event.type === 'file_created' ? 'créé' : 'modifié'}: ${fileEvent.data.path}`,
        file: fileEvent.data.path,
        status: 'completed'
      };

    case 'deploy_complete':
      return {
        type: 'complete',
        message: 'Déploiement terminé',
        status: 'completed'
      };

    case 'error':
      const errorEvent = event as ErrorEvent;
      return {
        type: 'error',
        message: errorEvent.data.message,
        status: 'completed'
      };

    default:
      return {
        type: 'thought',
        message: `Événement: ${event.type}`,
        status: 'in-progress'
      };
  }
}
