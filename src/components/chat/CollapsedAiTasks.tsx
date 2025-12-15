import { useState, useEffect, useMemo } from 'react';
import { Loader2, Lightbulb, FileText, Pencil, Plus, Search, ClipboardList, CheckCircle2, XCircle, FileEdit, Clock, Layout, Palette, Code, FileCode, Settings, Component, BarChart3, Menu, Mail } from 'lucide-react';
import type { GenerationEvent } from '@/types/agent';
import { Progress } from '@/components/ui/progress';

interface CollapsedAiTasksProps {
  events: GenerationEvent[];
  isDark?: boolean;
  isLoading?: boolean;
  autoExpand?: boolean;
  autoCollapse?: boolean;
  startTime?: number;
  defaultCollapsed?: boolean;
  summary?: string;
}

export function CollapsedAiTasks({ 
  events, 
  isDark = false, 
  isLoading = false, 
  autoExpand = false, 
  autoCollapse = false,
  startTime,
  defaultCollapsed = false,
  summary
}: CollapsedAiTasksProps) {
  const [isExpanded, setIsExpanded] = useState(defaultCollapsed ? false : autoExpand);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  
  // Mise à jour du temps écoulé en temps réel
  useEffect(() => {
    if (!isLoading || !startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100); // Update every 100ms for smooth display

    return () => clearInterval(interval);
  }, [isLoading, startTime]);
  
  // Auto-collapse quand la génération est terminée
  useEffect(() => {
    if (autoCollapse && !isLoading && events.length > 0) {
      const timer = setTimeout(() => setIsExpanded(false), 800);
      return () => clearTimeout(timer);
    }
    // Auto-expand pendant le chargement
    if (autoExpand && isLoading) {
      setIsExpanded(true);
    }
  }, [autoCollapse, autoExpand, isLoading, events.length]);

  // Calcul du fichier en cours de modification
  const currentFile = useMemo(() => {
    const inProgressEvents = events.filter(e => e.status === 'in-progress');
    const lastInProgress = inProgressEvents[inProgressEvents.length - 1];
    return lastInProgress?.file || null;
  }, [events]);

  // Estimation du temps restant
  useEffect(() => {
    if (!isLoading) {
      setEstimatedTime(null);
      return;
    }

    const completedEvents = events.filter(e => e.status === 'completed');
    const totalEvents = Math.max(events.length, 5); // Estimer au moins 5 étapes

    if (completedEvents.length > 2 && elapsedTime > 0) {
      // Calcul basé sur la vitesse moyenne
      const avgTimePerEvent = elapsedTime / completedEvents.length;
      const remainingEvents = Math.max(totalEvents - completedEvents.length, 2);
      const estimated = avgTimePerEvent * remainingEvents;
      setEstimatedTime(Math.max(estimated, 1000)); // Minimum 1 seconde
    } else if (elapsedTime > 0) {
      // Estimation initiale : 10-20 secondes pour une génération moyenne
      const baseEstimate = 15000;
      setEstimatedTime(Math.max(baseEstimate - elapsedTime, 2000));
    }
  }, [events, elapsedTime, isLoading]);

  // Calcul de la progression amélioré
  const progress = useMemo(() => {
    if (!isLoading) return 100;

    const completedEvents = events.filter(e => e.status === 'completed').length;
    const inProgressEvents = events.filter(e => e.status === 'in-progress').length;

    // Déterminer le nombre total d'événements attendus basé sur la phase
    const phases = events.map(e => e.phase).filter(Boolean);
    const currentPhase = phases[phases.length - 1];

    // Estimation du nombre total d'étapes en fonction de la phase
    let estimatedTotal = 10; // Par défaut
    if (currentPhase === 'analyze') {
      estimatedTotal = 2;
    } else if (currentPhase === 'context') {
      estimatedTotal = 4;
    } else if (currentPhase === 'generation') {
      // Pendant la génération, estimer selon le nombre de fichiers déjà créés
      const fileEvents = events.filter(e => e.file).length;
      estimatedTotal = Math.max(fileEvents + 3, 8); // Au moins 8 étapes
    } else if (currentPhase === 'validation') {
      estimatedTotal = completedEvents + 2;
    }

    const totalEvents = Math.max(events.length, estimatedTotal);

    if (completedEvents === 0 && inProgressEvents === 0) return 5; // Début

    // Ajouter un bonus pour les événements en cours (compte comme 0.5)
    const effectiveCompleted = completedEvents + (inProgressEvents * 0.5);

    // Progress de 5% à 95% basé sur les événements complétés
    const calculatedProgress = 5 + (effectiveCompleted / totalEvents) * 90;

    return Math.min(Math.max(calculatedProgress, 5), 95);
  }, [events, isLoading]);

  // Format du temps
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Compter les différents types d'événements
  const editCount = events.filter(e => e.type === 'edit' || e.type === 'create').length;
  const hasError = events.some(e => e.type === 'error');

  // Si pas d'événements et pas de chargement, ne rien afficher
  if (events.length === 0 && !isLoading) return null;

  // Fonction pour obtenir l'icône selon le type d'événement et le message
  const getEventIcon = (event: GenerationEvent) => {
    const iconClass = "h-4 w-4 flex-shrink-0";
    const color = isDark ? '#94a3b8' : '#64748b';

    // Icônes spécifiques basées sur le message pour plus de variété
    const message = event.message?.toLowerCase() || '';

    if (message.includes('graphique') || message.includes('chart')) {
      return <BarChart3 className={iconClass} style={{ color }} />;
    }
    if (message.includes('menu') || message.includes('navigation')) {
      return <Menu className={iconClass} style={{ color }} />;
    }
    if (message.includes('style') || message.includes('css')) {
      return <Palette className={iconClass} style={{ color }} />;
    }
    if (message.includes('composant') || message.includes('component')) {
      return <Component className={iconClass} style={{ color }} />;
    }
    if (message.includes('formulaire') || message.includes('form') || message.includes('contact')) {
      return <Mail className={iconClass} style={{ color }} />;
    }
    if (message.includes('html') || message.includes('structure')) {
      return <Layout className={iconClass} style={{ color }} />;
    }
    if (message.includes('config') || message.includes('dépendances')) {
      return <Settings className={iconClass} style={{ color }} />;
    }
    if (message.includes('code') || message.includes('typescript') || message.includes('javascript')) {
      return <Code className={iconClass} style={{ color }} />;
    }

    // Icônes par type d'événement
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
        return <FileCode className={iconClass} style={{ color }} />;
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
    <div className="relative flex w-full flex-col space-y-2">
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
                  ? `Thinking for ${Math.floor(elapsedTime / 1000)}s...` 
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

      {/* Bouton "voir" discret à droite - style Lovable */}
      {!autoExpand && !isLoading && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute right-0 top-0 text-xs transition-colors duration-200"
          aria-label={isExpanded ? "Masquer" : "Voir"}
          style={{
            color: isDark ? '#64748b' : '#94a3b8',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#03A5C0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isDark ? '#64748b' : '#94a3b8';
          }}
        >
          {isExpanded ? 'hide' : 'show all'}
        </button>
      )}
    </div>
  );
}
