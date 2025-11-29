import { useState, useEffect, useMemo } from 'react';
import { Loader2, Clock, FileEdit } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LoadingProgressProps {
  isLoading: boolean;
  isDark?: boolean;
  startTime?: number;
  currentFile?: string | null;
  progress?: number;
  completedSteps?: number;
  totalSteps?: number;
}

export function LoadingProgress({
  isLoading,
  isDark = false,
  startTime,
  currentFile,
  progress: externalProgress,
  completedSteps = 0,
  totalSteps = 0
}: LoadingProgressProps) {
  const [isExpanded, setIsExpanded] = useState(isLoading);
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
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  // Auto-expand pendant le chargement, collapse quand terminé
  useEffect(() => {
    if (isLoading) {
      setIsExpanded(true);
    } else {
      const timer = setTimeout(() => setIsExpanded(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Estimation du temps restant
  useEffect(() => {
    if (!isLoading) {
      setEstimatedTime(null);
      return;
    }

    if (completedSteps > 2 && elapsedTime > 0 && totalSteps > 0) {
      const avgTimePerStep = elapsedTime / completedSteps;
      const remainingSteps = Math.max(totalSteps - completedSteps, 2);
      const estimated = avgTimePerStep * remainingSteps;
      setEstimatedTime(Math.max(estimated, 1000));
    } else if (elapsedTime > 0) {
      const baseEstimate = 15000;
      setEstimatedTime(Math.max(baseEstimate - elapsedTime, 2000));
    }
  }, [completedSteps, totalSteps, elapsedTime, isLoading]);

  const progress = externalProgress ?? 0;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Si jamais chargé, ne rien afficher
  if (!isLoading && elapsedTime === 0) return null;

  return (
    <div className="relative">
      <div 
        className="relative overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: isExpanded ? 'auto' : '0px', opacity: isExpanded ? 1 : 0 }}
      >
        <div 
          className="space-y-2 p-3 rounded-lg"
          style={{
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
            border: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* En-tête avec fichier en cours */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#03A5C0' }} />
              <span className="font-medium">{isLoading ? 'Generating...' : 'Generation complete'}</span>
              {currentFile && isLoading && (
                <>
                  <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>•</span>
                  <FileEdit className="h-3.5 w-3.5" style={{ color: '#03A5C0' }} />
                  <span className="font-mono" style={{ color: isDark ? '#e2e8f0' : '#334155' }}>
                    {currentFile}
                  </span>
                </>
              )}
            </div>
            
            {/* Temps écoulé et estimation */}
            <div className="flex items-center gap-3" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium">{formatTime(elapsedTime)}</span>
              </div>
              {estimatedTime && estimatedTime > 0 && isLoading && (
                <div className="flex items-center gap-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                  <span>~{formatTime(estimatedTime)} left</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <div 
              className="flex items-center justify-between text-[10px]" 
              style={{ color: isDark ? '#64748b' : '#94a3b8' }}
            >
              <span>{Math.round(progress)}% complete</span>
              {totalSteps > 0 && (
                <span>
                  {completedSteps}/{totalSteps} steps
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bouton "show all" discret à droite - affiché uniquement quand terminé */}
      {!isLoading && elapsedTime > 0 && (
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