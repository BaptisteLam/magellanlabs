import { useMemo } from "react";
import { Lightbulb, FileText, CheckCircle2 } from "lucide-react";
import { CollapsedAiTasks } from "./CollapsedAiTasks";
import { LoadingProgress } from "./LoadingProgress";
import { MessageActions } from "./MessageActions";
import { GenerationEvent } from "@/types/agent";

interface FileAffected {
  path: string;
  description: string;
  changeType: 'modified' | 'created' | 'deleted';
}

interface AiGenerationMessageProps {
  message: {
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    metadata?: {
      type?: string;
      thought_duration?: number;
      intent_message?: string;
      generation_events?: GenerationEvent[];
      files_created?: number;
      files_modified?: number;
      new_files?: string[];
      modified_files?: string[];
      files_affected?: FileAffected[];
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
      project_files?: Record<string, string>;
    };
    token_count?: number;
    id?: string;
  };
  messageIndex: number;
  isLatestMessage: boolean;
  isDark: boolean;
  isLoading?: boolean;
  generationStartTime?: number;
  onRestore: (messageIdx: number) => Promise<void>;
  onGoToPrevious: () => Promise<void>;
  /** Show progress bar only for initial site generation, not reprompts */
  isFirstGeneration?: boolean;
}

export default function AiGenerationMessage({
  message,
  messageIndex,
  isLatestMessage,
  isDark,
  isLoading = false,
  generationStartTime,
  onRestore,
  onGoToPrevious,
  isFirstGeneration = false,
}: AiGenerationMessageProps) {
  const {
    thought_duration = 0,
    intent_message = '',
    generation_events = [],
    files_created = 0,
    files_modified = 0,
    files_affected = [],
    modified_files = [],
  } = message.metadata || {};

  const thoughtSeconds = Math.round(thought_duration / 1000);
  const totalChanges = files_created + files_modified;
  
  // 🆕 Générer un résumé plus informatif
  const summary = useMemo(() => {
    if (totalChanges > 0) {
      const parts = [];
      if (files_created > 0) parts.push(`${files_created} créé${files_created > 1 ? 's' : ''}`);
      if (files_modified > 0) parts.push(`${files_modified} modifié${files_modified > 1 ? 's' : ''}`);
      return parts.join(', ');
    }
    return 'Modifications appliquées';
  }, [totalChanges, files_created, files_modified]);

  // Extract string content from message
  const contentString = typeof message.content === 'string' 
    ? message.content 
    : '';

  // Trouver le fichier en cours de modification
  const currentFile = useMemo(() => {
    const inProgressEvents = generation_events.filter(e => e.status === 'in-progress');
    const lastInProgress = inProgressEvents[inProgressEvents.length - 1];
    return lastInProgress?.file || null;
  }, [generation_events]);

  // Calculer la progression
  const progress = useMemo(() => {
    if (!isLoading) return 100;
    const totalEvents = Math.max(generation_events.length, 5);
    const completedEvents = generation_events.filter(e => e.status === 'completed').length;
    if (completedEvents === 0) return 5;
    return Math.min(5 + (completedEvents / totalEvents) * 90, 95);
  }, [generation_events, isLoading]);

  // 🆕 Extraire les fichiers affectés des événements de génération
  const fileChanges = useMemo(() => {
    const changes: Array<{ path: string; description: string; status: 'completed' | 'in-progress' }> = [];
    
    // D'abord les filesAffected du metadata
    if (files_affected && files_affected.length > 0) {
      for (const file of files_affected) {
        changes.push({
          path: file.path,
          description: file.description,
          status: 'completed'
        });
      }
    }
    
    // Ensuite les modified_files
    if (modified_files && modified_files.length > 0 && changes.length === 0) {
      for (const path of modified_files) {
        changes.push({
          path,
          description: 'Fichier modifié',
          status: 'completed'
        });
      }
    }

    // Ajouter les fichiers des événements de génération
    for (const event of generation_events) {
      if (event.file && !changes.find(c => c.path === event.file)) {
        changes.push({
          path: event.file,
          description: event.message || 'Modification',
          status: event.status === 'completed' ? 'completed' : 'in-progress'
        });
      }
    }
    
    return changes.slice(0, 5); // Limiter à 5 fichiers affichés
  }, [files_affected, modified_files, generation_events]);

  return (
    <div className="space-y-3">
      {/* 1. Message d'intention contextuel PROÉMINENT - Style Lovable */}
      {intent_message && (
        <div className="text-sm text-foreground mb-2">
          {intent_message}
        </div>
      )}

      {/* 2. Thought duration (discret) */}
      {thought_duration > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lightbulb className="h-3 w-3 text-amber-500" />
          <span>Réflexion : {thoughtSeconds}s</span>
        </div>
      )}

      {/* 3. Barre de chargement - UNIQUEMENT pour la génération initiale */}
      {isFirstGeneration && (
        <LoadingProgress
          isLoading={isLoading}
          isDark={isDark}
          startTime={generationStartTime}
          currentFile={currentFile}
          progress={progress}
          completedSteps={generation_events.filter(e => e.status === 'completed').length}
          totalSteps={generation_events.length}
        />
      )}

      {/* 4. CollapsedAiTasks - toujours visible */}
      {generation_events.length > 0 && (
        <CollapsedAiTasks 
          events={generation_events}
          isDark={isDark}
          isLoading={isLoading}
          defaultCollapsed={!isLoading}
          summary={summary}
          autoExpand={isLoading}
          autoCollapse={true}
        />
      )}

      {/* 5. Fichiers affectés (badges visuels) */}
      {!isLoading && fileChanges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {fileChanges.map((file, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground"
              title={file.description}
            >
              <FileText className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{file.path.split('/').pop()}</span>
              {file.status === 'completed' && (
                <CheckCircle2 className="h-3 w-3 text-primary" />
              )}
            </div>
          ))}
          {(modified_files?.length || 0) > 5 && (
            <span className="text-xs text-muted-foreground">
              +{(modified_files?.length || 0) - 5} autres
            </span>
          )}
        </div>
      )}

      {/* 6. Message de conclusion détaillé (uniquement après génération) */}
      {!isLoading && contentString && (
        <p className="text-sm text-muted-foreground mt-2">
          {contentString}
        </p>
      )}

      {/* 6. Action buttons - UNIQUEMENT sous le dernier message AI */}
      {!isLoading && isLatestMessage && (
        <MessageActions
          content={contentString}
          messageIndex={messageIndex}
          isLatestMessage={isLatestMessage}
          onRestore={onRestore}
          onGoToPrevious={onGoToPrevious}
        />
      )}
    </div>
  );
}
