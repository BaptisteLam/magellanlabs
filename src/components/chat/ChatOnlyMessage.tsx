import { useState, useEffect, useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { MessageActions } from "./MessageActions";
import { CollapsedAiTasks } from "./CollapsedAiTasks";
import { LoadingProgress } from "./LoadingProgress";
import ReactMarkdown from 'react-markdown';
import type { GenerationEvent } from '@/types/agent';

interface ChatOnlyMessageProps {
  message: {
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    metadata?: {
      thought_duration?: number;
      total_tokens?: number;
      generation_events?: GenerationEvent[];
    };
    token_count?: number;
    id?: string;
  };
  messageIndex: number;
  isLatestMessage: boolean;
  isDark: boolean;
  isLoading?: boolean;
  generationStartTime?: number;
  onRestore: (messageIdx: number) => void;
  onGoToPrevious: () => void;
  onImplementPlan?: (plan: string) => void;
  showImplementButton?: boolean;
}

export default function ChatOnlyMessage({
  message,
  messageIndex,
  isLatestMessage,
  isDark,
  isLoading = false,
  generationStartTime,
  onRestore,
  onGoToPrevious,
  onImplementPlan,
  showImplementButton = false,
}: ChatOnlyMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  
  const thoughtDuration = message.metadata?.thought_duration || 0;
  const thoughtSeconds = Math.round(thoughtDuration / 1000);
  const contentString = typeof message.content === 'string' ? message.content : '';
  const generation_events = message.metadata?.generation_events || [];

  // Calculer la progression pour la barre de chargement
  const currentFile = useMemo(() => {
    const inProgressEvents = generation_events.filter(e => e.status === 'in-progress');
    const lastInProgress = inProgressEvents[inProgressEvents.length - 1];
    return lastInProgress?.file || null;
  }, [generation_events]);

  const progress = useMemo(() => {
    if (!isLoading) return 100;
    const totalEvents = Math.max(generation_events.length, 5);
    const completedEvents = generation_events.filter(e => e.status === 'completed').length;
    if (completedEvents === 0) return 5;
    return Math.min(5 + (completedEvents / totalEvents) * 90, 95);
  }, [generation_events, isLoading]);

  // Effet machine à écrire rapide
  useEffect(() => {
    if (!contentString) return;
    
    let currentIndex = 0;
    const typingSpeed = 10; // Très rapide (10ms par caractère)
    
    const typeNextChar = () => {
      if (currentIndex < contentString.length) {
        setDisplayedText(contentString.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeNextChar, typingSpeed);
      } else {
        setIsTyping(false);
      }
    };
    
    typeNextChar();
    
    return () => {
      currentIndex = contentString.length;
    };
  }, [contentString]);

  return (
    <div className="space-y-3">
      {/* Thought duration */}
      {thoughtSeconds > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>Thought for {thoughtSeconds}s</span>
        </div>
      )}

      {/* Barre de chargement - pendant la génération */}
      {isLoading && (
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

      {/* CollapsedAiTasks - toujours affiché si events présents */}
      {generation_events.length > 0 && (
        <CollapsedAiTasks 
          events={generation_events}
          isDark={isDark}
          isLoading={isLoading}
          defaultCollapsed={!isLoading}
          summary={`${generation_events.filter(e => e.status === 'completed').length} tasks completed`}
          autoExpand={isLoading}
          autoCollapse={true}
        />
      )}

      {/* Message avec formatage markdown */}
      <div 
        className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} prose prose-sm max-w-none`}
        style={{
          color: isDark ? 'rgb(203, 213, 225)' : 'rgb(71, 85, 105)'
        }}
      >
        <ReactMarkdown
          components={{
            h3: ({node, ...props}) => <h3 className="font-bold text-base mt-4 mb-2" {...props} />,
            h4: ({node, ...props}) => <h4 className="font-semibold text-sm mt-3 mb-2" {...props} />,
            p: ({node, ...props}) => <p className="mb-3" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
            em: ({node, ...props}) => <em className="italic" {...props} />,
            code: ({node, inline, ...props}: any) => 
              inline ? 
                <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props} /> :
                <code className="block bg-muted p-2 rounded text-xs my-2" {...props} />
          }}
        >
          {displayedText}
        </ReactMarkdown>
        {isTyping && <span className="inline-block w-1 h-4 bg-current animate-pulse ml-1" />}
      </div>

      {/* Action buttons - seulement quand le typing est fini ET c'est le dernier message */}
      {!isTyping && isLatestMessage && (
        <div className="space-y-3">
          {/* Bouton "Implémenter le plan" - UNIQUEMENT en mode chat */}
          {showImplementButton && onImplementPlan && (
            <button
              onClick={() => onImplementPlan(contentString)}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-sm gap-2 transition-all border rounded-full px-4 py-0"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)'
              }}
            >
              Implémenter le plan
            </button>
          )}
          
          <MessageActions
            content={contentString}
            messageIndex={messageIndex}
            isLatestMessage={isLatestMessage}
            onRestore={onRestore}
            onGoToPrevious={onGoToPrevious}
            hideUndoButton={true}
          />
        </div>
      )}
    </div>
  );
}
