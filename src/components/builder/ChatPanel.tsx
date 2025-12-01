import { CollapsedAiTasks } from '@/components/chat/CollapsedAiTasks';
import { MessageActions } from '@/components/chat/MessageActions';
import ChatOnlyMessage from '@/components/chat/ChatOnlyMessage';
import type { Message } from '@/hooks/useChat';
import type { GenerationEvent } from '@/types/agent';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChatPanelProps {
  messages: Message[];
  isDark: boolean;
  isGenerating: boolean;
  generationEvents: GenerationEvent[];
  currentVersionIndex: number | null;
  onRevertToVersion: (index: number) => void;
  projectFiles: Record<string, string>;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatPanel({
  messages,
  isDark,
  isGenerating,
  generationEvents,
  currentVersionIndex,
  onRevertToVersion,
  projectFiles,
  chatEndRef
}: ChatPanelProps) {
  const handleCopyCode = async () => {
    try {
      const codeStr = JSON.stringify(projectFiles, null, 2);
      await navigator.clipboard.writeText(codeStr);
    } catch (error) {
      console.error('Error copying code:', error);
    }
  };
  // Déterminer quels messages doivent être dimmed (versions futures)
  const shouldDimMessage = (index: number) => {
    if (currentVersionIndex === null) return false;
    return index > currentVersionIndex;
  };

  // Formater la date du message
  const formatMessageDate = (created_at?: string) => {
    if (!created_at) return '';
    const date = new Date(created_at);
    return format(date, "d MMM 'à' HH:mm", { locale: fr });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isDimmed = shouldDimMessage(index);
          const isRecapMessage = msg.metadata?.type === 'recap';
          const isIntroMessage = msg.metadata?.type === 'intro';
          const isChatMessage = msg.metadata?.type === 'message';
          const messageEvents = msg.metadata?.generation_events as GenerationEvent[] || [];

          return (
            <div
              key={index}
              className={`${msg.role === 'user' ? 'text-right' : 'text-left'} ${
                isDimmed ? 'opacity-40' : ''
              }`}
            >
              {msg.role === 'user' ? (
                <div className="space-y-1">
                {msg.created_at && (
                  <div className="text-center text-muted-foreground" style={{ fontSize: '12px' }}>
                    {formatMessageDate(msg.created_at)}
                  </div>
                )}
                  <div className="inline-block max-w-[80%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                  </div>
                </div>
              ) : (
                <div className="inline-block max-w-[90%] space-y-2">
                  {isIntroMessage && (
                    <div className="text-foreground/90 mb-2">
                      {typeof msg.content === 'string' ? msg.content : ''}
                    </div>
                  )}

                  {isChatMessage && (
                    <ChatOnlyMessage
                      message={msg}
                      messageIndex={index}
                      isLatestMessage={index === messages.length - 1}
                      isDark={isDark}
                      onRestore={onRevertToVersion}
                      onGoToPrevious={() => onRevertToVersion(Math.max(0, index - 1))}
                    />
                  )}

                  {messageEvents.length > 0 && (
                    <CollapsedAiTasks
                      events={messageEvents}
                      isDark={isDark}
                      isLoading={false}
                      startTime={msg.metadata?.startTime as number | undefined}
                    />
                  )}

                  {isRecapMessage && (
                    <div className="space-y-2">
                      <div className="text-foreground/90">
                        {typeof msg.content === 'string' ? msg.content : ''}
                      </div>
                      <MessageActions
                        content={typeof msg.content === 'string' ? msg.content : ''}
                        messageIndex={index}
                        isLatestMessage={index === messages.length - 1}
                        tokenCount={msg.metadata?.total_tokens || msg.token_count}
                        onRestore={onRevertToVersion}
                        isDark={isDark}
                      />
                    </div>
                  )}

                  {!isIntroMessage && !isRecapMessage && !isChatMessage && (
                    <div className="text-foreground/90 bg-muted/50 rounded-lg px-4 py-2">
                      {typeof msg.content === 'string' ? msg.content : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isGenerating && generationEvents.length > 0 && (
          <div className="text-left">
            <CollapsedAiTasks
              events={generationEvents}
              isDark={isDark}
              isLoading={true}
              startTime={Date.now() - (generationEvents[0]?.duration ? generationEvents[0].duration * 1000 : 0)}
            />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
