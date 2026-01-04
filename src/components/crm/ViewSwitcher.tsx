/**
 * Composant pour basculer entre les différentes vues (Table, Kanban, Timeline, Calendar)
 */

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, Kanban, Calendar as CalendarIcon, Timeline } from 'lucide-react';
import { ViewType } from '@/types/crm-objects';

interface ViewSwitcherProps {
  currentView: ViewType;
  availableViews?: ViewType[];
  onViewChange: (view: ViewType) => void;
  className?: string;
}

const VIEW_ICONS: Record<ViewType, React.ComponentType<{ className?: string }>> = {
  table: Table,
  kanban: Kanban,
  timeline: Timeline,
  calendar: CalendarIcon,
};

const VIEW_LABELS: Record<ViewType, string> = {
  table: 'Table',
  kanban: 'Pipeline',
  timeline: 'Timeline',
  calendar: 'Calendrier',
};

export function ViewSwitcher({
  currentView,
  availableViews = ['table', 'kanban', 'timeline'],
  onViewChange,
  className,
}: ViewSwitcherProps) {
  return (
    <Tabs value={currentView} onValueChange={(v) => onViewChange(v as ViewType)} className={className}>
      <TabsList className="bg-surface/50 border border-white/10">
        {availableViews.map((view) => {
          const Icon = VIEW_ICONS[view];
          return (
            <TabsTrigger
              key={view}
              value={view}
              className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
            >
              <Icon className="w-4 h-4 mr-2" />
              {VIEW_LABELS[view]}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
