import { useState, useEffect } from 'react';
import { Loader2, Lightbulb, FileText, Pencil, Plus, Search, ClipboardList, CheckCircle2, XCircle, FileEdit } from 'lucide-react';
import type { GenerationEvent } from '@/types/agent';

interface CollapsedAiTasksProps {
  events: GenerationEvent[];
  isDark?: boolean;
  isLoading?: boolean;
  autoExpand?: boolean;
  autoCollapse?: boolean;
}

export function CollapsedAiTasks({ events, isDark = false, isLoading = false, autoExpand = false, autoCollapse = false }: CollapsedAiTasksProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  
  // Calculer le temps de réflexion en temps réel
  useEffect(() => {
    if (isLoading) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        setThinkingSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);
  
  // Auto-collapse quand la génération est terminée
  useEffect(() => {
    if (autoCollapse && !isLoading && events.length > 0) {
      const timer = setTimeout(() => setIsExpanded(false), 500);
      return () => clearTimeout(timer);
    }
  }, [autoCollapse, isLoading, events.length]);

  // Compter les différents types d'événements
  const editCount = events.filter(e => e.type === 'edit' || e.type === 'create').length;
  const hasError = events.some(e => e.type === 'error');

  // Si pas d'événements et pas de chargement, ne rien afficher
  if (events.length === 0 && !isLoading) return null;

  // Fonction pour obtenir l'icône selon le type d'événement
  const getEventIcon = (event: GenerationEvent) => {
    const iconClass = "h-4 w-4 flex-shrink-0";
    const color = isDark ? '#94a3b8' : '#64748b';
    
    switch (event.type) {
      case 'thought':
        return <Lightbulb className={iconClass} style={{ color }} />;
      case 'read':
        return <FileText className={iconClass} style={{ color }} />;
      case 'edit':
        return <Pencil className={iconClass} style={{ color }} />;
      case 'create':
        return <Plus className={iconClass} style={{ color }} />;
      case 'analyze':
        return <Search className={iconClass} style={{ color }} />;
      case 'plan':
        return <ClipboardList className={iconClass} style={{ color }} />;
      case 'write':
        return <FileEdit className={iconClass} style={{ color }} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-500`} />;
      default:
        return <Lightbulb className={iconClass} style={{ color }} />;
    }
  };

  // Fonction pour obtenir l'indicateur de statut
  const getStatusIndicator = (event: GenerationEvent) => {
    if (event.type === 'error') {
      return <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />;
    }
    
    if (event.status === 'completed' || event.type === 'complete') {
      return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
    }
    
    if (event.status === 'in-progress') {
      return <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: isDark ? '#94a3b8' : '#64748b' }} />;
    }
    
    return null;
  };

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
            // Vue compacte (collapsed)
            <div className="flex h-6 items-center gap-1.5 whitespace-nowrap text-base font-medium text-muted-foreground md:text-sm">
              <div className="mb-px flex shrink-0 items-center">
                {isLoading ? (
                  <Lightbulb className="h-4 w-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                ) : hasError ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              <span className="flex-shrink-0 font-normal">
                {isLoading 
                  ? `Thinking for ${thinkingSeconds}s...` 
                  : hasError 
                    ? 'Error occurred' 
                    : editCount > 0 
                      ? `${editCount} change${editCount > 1 ? 's' : ''} applied` 
                      : 'Completed'}
              </span>
            </div>
          ) : (
            // Vue étendue (expanded) avec animation
            <div className="pt-2 space-y-1">
              {events.map((event, idx) => {
                if (event.type === 'complete') return null;
                
                return (
                  <div 
                    key={idx} 
                    className="flex items-start gap-2 text-sm px-2 py-1.5 animate-fade-in"
                    style={{ 
                      color: isDark ? '#94a3b8' : '#64748b',
                      animationDelay: `${idx * 50}ms`,
                      animationFillMode: 'backwards'
                    }}
                  >
                    {getEventIcon(event)}
                    <span className="flex-1">
                      {event.type === 'thought' && (
                        <>
                          {event.duration 
                            ? `Analyzed request (${event.duration}s)` 
                            : event.message}
                        </>
                      )}
                      {event.type === 'read' && (
                        <>Reading {event.file || event.message}</>
                      )}
                      {event.type === 'edit' && (
                        <>Editing {event.file || event.message}</>
                      )}
                      {event.type === 'create' && (
                        <>Creating {event.file || event.message}</>
                      )}
                      {event.type === 'analyze' && (
                        <>Analyzing {event.file || event.message}</>
                      )}
                      {event.type === 'plan' && (
                        <>Planning {event.message}</>
                      )}
                      {event.type === 'write' && (
                        <>Writing {event.file || event.message}</>
                      )}
                      {event.type === 'error' && (
                        <span className="text-red-500">{event.message}</span>
                      )}
                    </span>
                    {getStatusIndicator(event)}
                  </div>
                );
              })}
              {isLoading && (
                <div 
                  className="flex items-center gap-2 text-sm px-2 py-1.5 animate-pulse" 
                  style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Working...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}