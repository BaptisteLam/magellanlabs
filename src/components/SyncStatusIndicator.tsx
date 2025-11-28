/**
 * Indicateur visuel du statut de synchronisation
 */

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/hooks/useSyncManager';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  lastSyncTime: number | null;
  pendingChanges: number;
  isOnline: boolean;
  className?: string;
}

export function SyncStatusIndicator({
  status,
  lastSyncTime,
  pendingChanges,
  isOnline,
  className
}: SyncStatusIndicatorProps) {
  const [relativeTime, setRelativeTime] = useState('');

  // Mise à jour du temps relatif
  useEffect(() => {
    if (!lastSyncTime) {
      setRelativeTime('Never synced');
      return;
    }

    const updateRelativeTime = () => {
      const seconds = Math.floor((Date.now() - lastSyncTime) / 1000);
      
      if (seconds < 10) {
        setRelativeTime('Just now');
      } else if (seconds < 60) {
        setRelativeTime(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setRelativeTime(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        setRelativeTime(`${hours}h ago`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [lastSyncTime]);

  // Icône et couleur selon le statut
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-muted-foreground',
        label: 'Offline',
        description: 'Changes saved locally'
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: Loader2,
          color: 'text-primary',
          label: 'Syncing',
          description: `${pendingChanges} change(s)`,
          animate: true
        };
      case 'synced':
        return {
          icon: CheckCircle2,
          color: 'text-green-500',
          label: 'Synced',
          description: relativeTime
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          label: 'Sync error',
          description: 'Saved locally'
        };
      case 'offline':
        return {
          icon: CloudOff,
          color: 'text-muted-foreground',
          label: 'Offline',
          description: 'Working offline'
        };
      default:
        return {
          icon: Cloud,
          color: 'text-muted-foreground',
          label: 'Not synced',
          description: pendingChanges > 0 ? `${pendingChanges} pending` : 'Up to date'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background/95 backdrop-blur',
        'transition-all duration-200',
        className
      )}
      title={`${config.label}: ${config.description}`}
    >
      <Icon 
        className={cn(
          'h-4 w-4',
          config.color,
          config.animate && 'animate-spin'
        )} 
      />
      
      <div className="flex flex-col">
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {config.description}
        </span>
      </div>

      {pendingChanges > 0 && status !== 'syncing' && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
          {pendingChanges}
        </span>
      )}
    </div>
  );
}
