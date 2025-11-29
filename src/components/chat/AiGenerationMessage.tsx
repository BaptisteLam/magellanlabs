import { Lightbulb } from "lucide-react";
import { CollapsedAiTasks } from "./CollapsedAiTasks";
import { MessageActions } from "./MessageActions";
import { GenerationEvent } from "@/types/agent";

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
  onRestore: (messageIdx: number) => Promise<void>;
  onGoToPrevious: () => Promise<void>;
}

export default function AiGenerationMessage({
  message,
  messageIndex,
  isLatestMessage,
  isDark,
  isLoading = false,
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

  return (
    <div className="space-y-3">
      {/* 1. Thought for Xs + Intent message */}
      {thought_duration > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>Thought for {thoughtSeconds}s</span>
        </div>
      )}
      
      {intent_message && (
        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {intent_message}
        </p>
      )}

      {/* 2. CollapsedAiTasks - Auto-collapse à la fin de la génération avec bouton "voir plus" */}
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

      {/* 3. Short conclusion message */}
      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {contentString}
      </p>

      {/* 4. Action buttons */}
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
