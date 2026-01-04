/**
 * CalendarView - Vue Calendrier
 * Affiche les records avec des dates dans un calendrier mensuel
 */

import { useMemo, useState } from 'react';
import { useObjects } from '@/hooks/useCRMObjects';
import { ObjectDefinition, CustomObject } from '@/types/crm-objects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  projectId: string;
  objectType: string;
  definition: ObjectDefinition;
  queryOptions?: any;
  onEditRecord?: (recordId: string) => void;
  onCreateRecord?: (date?: Date) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  records: CustomObject[];
}

export function CalendarView({
  projectId,
  objectType,
  definition,
  queryOptions,
  onEditRecord,
  onCreateRecord,
}: CalendarViewProps) {
  const { data: records = [], isLoading } = useObjects(projectId, objectType, queryOptions);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Trouver le premier champ date/datetime
  const dateField = useMemo(
    () => definition.fields.find((f) => f.type === 'date' || f.type === 'datetime'),
    [definition]
  );

  // Générer les jours du calendrier (incluant les jours des mois précédent/suivant)
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { locale: fr });
    const calendarEnd = endOfWeek(monthEnd, { locale: fr });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map((date) => ({
      date,
      isCurrentMonth: isSameMonth(date, currentMonth),
      isToday: isToday(date),
      records: dateField
        ? records.filter((record) => {
            const recordDate = record.data[dateField.name];
            if (!recordDate) return false;
            return isSameDay(parseISO(recordDate as string), date);
          })
        : [],
    }));
  }, [currentMonth, records, dateField]);

  // Grouper par semaines
  const weeks = useMemo(() => {
    const weeksArray: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeksArray.push(calendarDays.slice(i, i + 7));
    }
    return weeksArray;
  }, [calendarDays]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dateField) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <CalendarIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucun champ date trouvé</h3>
          <p className="text-sm text-gray-400">
            Ajoutez un champ de type "date" ou "datetime" à cet objet pour utiliser la vue Calendrier
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h2>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Aujourd'hui
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="flex-1 grid grid-rows-6 gap-1 overflow-hidden">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1">
              {week.map((day) => (
                <div
                  key={day.date.toISOString()}
                  className={cn(
                    'relative border border-white/10 rounded-lg p-2 overflow-hidden transition-colors',
                    !day.isCurrentMonth && 'bg-surface/20 text-gray-600',
                    day.isCurrentMonth && 'bg-surface/40 hover:bg-surface/60',
                    day.isToday && 'ring-2 ring-cyan-500'
                  )}
                >
                  {/* Date */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        day.isToday
                          ? 'bg-cyan-500 text-white rounded-full w-5 h-5 flex items-center justify-center'
                          : day.isCurrentMonth
                          ? 'text-white'
                          : 'text-gray-600'
                      )}
                    >
                      {format(day.date, 'd')}
                    </span>

                    {day.isCurrentMonth && (
                      <button
                        onClick={() => onCreateRecord?.(day.date)}
                        className="text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    {day.records.slice(0, 3).map((record) => {
                      // Trouver le champ status pour la couleur
                      const statusField = definition.fields.find((f) => f.type === 'status');
                      let color = '#03A5C0';

                      if (statusField && record.data[statusField.name]) {
                        const statusValue = record.data[statusField.name];
                        const statusOption = statusField.config?.options?.find(
                          (opt: any) => opt.id === statusValue
                        );
                        if (statusOption?.color) {
                          color = statusOption.color;
                        }
                      }

                      return (
                        <button
                          key={record.id}
                          onClick={() => onEditRecord?.(record.id)}
                          className="w-full text-left px-1.5 py-0.5 rounded text-xs truncate hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: `${color}20`,
                            borderLeft: `3px solid ${color}`,
                          }}
                          title={String(record.data[definition.fields[0]?.name] || '')}
                        >
                          {String(record.data[definition.fields[0]?.name] || 'Sans nom')}
                        </button>
                      );
                    })}

                    {day.records.length > 3 && (
                      <div className="text-xs text-gray-400 pl-1">
                        +{day.records.length - 3} de plus
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
