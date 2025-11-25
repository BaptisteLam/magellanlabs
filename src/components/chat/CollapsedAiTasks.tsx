import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { GenerationEvent } from '@/types/agent';

interface CollapsedAiTasksProps {
  events: GenerationEvent[];
  isDark?: boolean;
  isLoading?: boolean;
  autoExpand?: boolean;
}

export function CollapsedAiTasks({ events, isDark = false, isLoading = false, autoExpand = false }: CollapsedAiTasksProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);

  // Compter les edits
  const editCount = events.filter(e => e.type === 'edit').length;
  const hasError = events.some(e => e.type === 'error');

  // Si pas d'événements et pas de chargement, ne rien afficher
  if (events.length === 0 && !isLoading) return null;

  return (
    <div className="relative flex w-full flex-col">
      {!autoExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute right-0 top-0 z-10 flex h-6 items-center justify-center px-2 py-1 text-xs font-normal transition-all duration-200 ease-out hover:opacity-70"
          aria-label={isExpanded ? "Collapse tool uses" : "Expand tool uses"}
          style={{
            color: isDark ? '#94a3b8' : '#64748b'
          }}
        >
          {isExpanded ? 'masquer' : 'voir'}
        </button>
      )}
      
      <div 
        className="relative overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: isExpanded ? 'auto' : '24px' }}
      >
        <div className={isExpanded ? 'flex flex-col' : 'flex h-full items-end'}>
          {!isExpanded ? (
            <div className="flex h-6 items-center gap-1.5 whitespace-nowrap text-base font-medium text-muted-foreground md:text-sm">
              <div className="mb-px flex shrink-0 items-center">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                ) : hasError ? (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    className="text-red-500"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                ) : (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="100%" 
                    height="100%" 
                    viewBox="0 -960 960 960" 
                    className="shrink-0 h-4 w-4 text-muted-foreground" 
                    fill="currentColor"
                  >
                    <path d="M560-110v-81q0-5.57 2-10.78 2-5.22 7-10.22l211.61-210.77q9.11-9.12 20.25-13.18Q812-440 823-440q12 0 23 4.5t20 13.5l37 37q9 9 13 20t4 22-4.5 22.5-13.58 20.62L692-89q-5 5-10.22 7-5.21 2-10.78 2h-81q-12.75 0-21.37-8.63Q560-97.25 560-110m300-233-37-37zM620-140h38l121-122-37-37-122 121zM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h315q12.44 0 23.72 5T578-862l204 204q8 8 13 19.28t5 23.72v71q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-56H550q-12.75 0-21.37-8.63Q520-617.25 520-630v-190H220v680h250q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32Q482.75-80 470-80zm0-60v-680zm541-141-19-18 37 37z"></path>
                  </svg>
                )}
              </div>
              <span className="flex-shrink-0 font-normal">
                {isLoading ? 'Thinking...' : hasError ? 'Error occurred' : editCount > 0 ? `${editCount} edit${editCount > 1 ? 's' : ''} made` : 'Generation completed'}
              </span>
            </div>
          ) : (
            <div className="pt-2 space-y-1">
              {events.map((event, idx) => {
                // Déterminer si c'est le dernier événement non-complete (donc en cours)
                const isLastNonComplete = idx === events.length - 1 && event.type !== 'complete' && event.type !== 'error';
                const isActive = isLoading && isLastNonComplete;
                
                return (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-2 text-sm px-2 py-1.5 rounded-md transition-all duration-300 ${
                      isActive 
                        ? 'bg-[#03A5C0]/10 border border-[#03A5C0]/30 animate-pulse' 
                        : ''
                    }`}
                    style={{ 
                      color: isDark ? '#94a3b8' : '#64748b'
                    }}
                  >
                    {event.type === 'thought' && (
                      <>
                        <span className="text-base flex-shrink-0">💡</span>
                        <span className={isActive ? 'font-medium' : ''}>
                          {event.duration ? `Thought for ${event.duration}s` : event.message}
                        </span>
                      </>
                    )}
                    {event.type === 'read' && (
                      <>
                        <span className="text-base flex-shrink-0">📄</span>
                        <span className={isActive ? 'font-medium' : ''}>
                          Read {event.file || event.message}
                        </span>
                      </>
                    )}
                    {event.type === 'edit' && (
                      <>
                        <span className="text-base flex-shrink-0">✏️</span>
                        <span className={isActive ? 'font-medium' : ''}>
                          Edited {event.file || event.message}
                        </span>
                      </>
                    )}
                    {event.type === 'complete' && (
                      <>
                        <span className="text-base flex-shrink-0">✅</span>
                        <span>{event.message}</span>
                      </>
                    )}
                    {event.type === 'error' && (
                      <>
                        <span className="text-base flex-shrink-0">❌</span>
                        <span className="text-red-500">{event.message}</span>
                      </>
                    )}
                  </div>
                );
              })}
              {isLoading && events.length === 0 && (
                <div 
                  className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-[#03A5C0]/10 border border-[#03A5C0]/30 animate-pulse" 
                  style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-medium">Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
