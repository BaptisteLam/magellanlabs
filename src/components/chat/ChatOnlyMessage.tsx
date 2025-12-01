import { useState, useEffect } from "react";
import { Lightbulb } from "lucide-react";
import { MessageActions } from "./MessageActions";
import ReactMarkdown from 'react-markdown';

interface ChatOnlyMessageProps {
  message: {
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    metadata?: {
      thought_duration?: number;
      total_tokens?: number;
    };
    token_count?: number;
    id?: string;
  };
  messageIndex: number;
  isLatestMessage: boolean;
  isDark: boolean;
  onRestore: (messageIdx: number) => void;
  onGoToPrevious: () => void;
  onImplementPlan?: (plan: string) => void;
}

export default function ChatOnlyMessage({
  message,
  messageIndex,
  isLatestMessage,
  isDark,
  onRestore,
  onGoToPrevious,
  onImplementPlan,
}: ChatOnlyMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  
  const thoughtDuration = message.metadata?.thought_duration || 0;
  const thoughtSeconds = Math.round(thoughtDuration / 1000);
  const contentString = typeof message.content === 'string' ? message.content : '';

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

      {/* Action buttons - seulement quand le typing est fini */}
      {!isTyping && (
        <div className="space-y-3">
          {/* Bouton "Implémenter le plan" */}
          {onImplementPlan && (
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
            tokenCount={message.metadata?.total_tokens || message.token_count}
            onRestore={onRestore}
            onGoToPrevious={onGoToPrevious}
            hideUndoButton={true}
          />
        </div>
      )}
    </div>
  );
}
