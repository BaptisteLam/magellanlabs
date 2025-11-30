import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { CollapsedAiTasks } from "./CollapsedAiTasks";
import { LoadingProgress } from "./LoadingProgress";
import { MessageActions } from "./MessageActions";
import { GenerationEvent } from "@/types/agent";
import { TypewriterText } from "./TypewriterText";
import { MarkdownText } from "./MarkdownText";

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
}: AiGenerationMessageProps) {
  const {
    thought_duration = 0,
    intent_message = '',
    generation_events = [],
    files_created = 0,
    files_modified = 0,
    total_tokens,
  } = message.metadata || {};

  const thoughtSeconds = Math.round(thought_duration / 1000);
  const totalChanges = files_created + files_modified;
  const summary = totalChanges > 0 
    ? `${totalChanges} ${totalChanges === 1 ? 'edit' : 'edits'} made`
    : 'Changes applied';

  // Extract string content from message
  const contentString = typeof message.content === 'string' 
    ? message.content 
    : '';

  // State pour contrôler l'affichage du typewriter
  const [showThoughtTypewriter, setShowThoughtTypewriter] = useState(!isLoading && thought_duration > 0);
  const [showIntentTypewriter, setShowIntentTypewriter] = useState(false);
  const [showContentTypewriter, setShowContentTypewriter] = useState(false);

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

  // Générer un message de résumé court
  const shortSummary = useMemo(() => {
    if (files_created && files_modified) {
      return `Created ${files_created} file${files_created > 1 ? 's' : ''} and modified ${files_modified} file${files_modified > 1 ? 's' : ''}.`;
    } else if (files_created) {
      return `Created ${files_created} new file${files_created > 1 ? 's' : ''}.`;
    } else if (files_modified) {
      return `Modified ${files_modified} file${files_modified > 1 ? 's' : ''}.`;
    }
    return 'Changes applied successfully.';
  }, [files_created, files_modified]);

  return (
    <div className="space-y-3">
      {/* 1. Thought for Xs + Intent message avec effet typewriter */}
      {thought_duration > 0 && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          {showThoughtTypewriter ? (
            <TypewriterText 
              text={`Thought for ${thoughtSeconds}s`}
              speed={15}
              onComplete={() => setShowIntentTypewriter(true)}
            />
          ) : (
            <span>Thought for {thoughtSeconds}s</span>
          )}
        </div>
      )}
      
      {intent_message && !isLoading && (
        <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {showIntentTypewriter ? (
            <TypewriterText 
              text={intent_message}
              speed={15}
              onComplete={() => setShowContentTypewriter(true)}
            />
          ) : (
            <MarkdownText text={intent_message} />
          )}
        </div>
      )}

      {/* 2. Barre de chargement - Reste indéfiniment avec bouton "show all" discret */}
      <LoadingProgress
        isLoading={isLoading}
        isDark={isDark}
        startTime={generationStartTime}
        currentFile={currentFile}
        progress={progress}
        completedSteps={generation_events.filter(e => e.status === 'completed').length}
        totalSteps={generation_events.length}
      />

      {/* 3. CollapsedAiTasks - Reste indéfiniment avec bouton "show all" discret */}
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

      {/* 4. Message de conclusion détaillé avec effet typewriter et markdown */}
      {!isLoading && contentString && (
        <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {showContentTypewriter ? (
            <TypewriterText 
              text={contentString}
              speed={15}
            />
          ) : (
            <MarkdownText text={contentString} />
          )}
        </div>
      )}

      {/* 5. Action buttons */}
      {!isLoading && (
        <MessageActions
          content={contentString}
          messageIndex={messageIndex}
          isLatestMessage={isLatestMessage}
          tokenCount={total_tokens || message.token_count}
          onRestore={onRestore}
          onGoToPrevious={onGoToPrevious}
        />
      )}
    </div>
  );
}
