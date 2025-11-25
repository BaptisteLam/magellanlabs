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
          className="absolute right-0 top-0 z-10 flex h-6 items-center justify-center rounded px-2 py-1 text-xs font-normal transition-all duration-200 ease-out"
          aria-label={isExpanded ? "Collapse tool uses" : "Expand tool uses"}
          style={{
            color: isDark ? '#94a3b8' : '#64748b',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(148, 163, 184, 0.2)',
            border: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(148, 163, 184, 0.3)'}`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(51, 65, 85, 0.7)' : 'rgba(148, 163, 184, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(148, 163, 184, 0.2)';
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
                return (
                  <div 
                    key={idx} 
                    className="flex items-start gap-2 text-sm px-2 py-1.5"
                    style={{ 
                      color: isDark ? '#94a3b8' : '#64748b'
                    }}
                  >
                    {event.type === 'thought' && (
                      <>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                        </svg>
                        <span>
                          {event.duration ? `Thought for ${event.duration}s` : event.message}
                        </span>
                      </>
                    )}
                    {event.type === 'read' && (
                      <>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                        </svg>
                        <span>
                          Read {event.file || event.message}
                        </span>
                      </>
                    )}
                    {event.type === 'edit' && (
                      <>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                        <span>
                          Edited {event.file || event.message}
                        </span>
                      </>
                    )}
                    {event.type === 'complete' && null}
                    {event.type === 'error' && (
                      <>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-red-500">{event.message}</span>
                      </>
                    )}
                  </div>
                );
              })}
              {isLoading && events.length === 0 && (
                <div 
                  className="flex items-center gap-2 text-sm px-2 py-1.5" 
                  style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
