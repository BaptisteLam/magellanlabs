/**
 * TimelineView - Vue Timeline (Gantt-like)
 * Affiche les records sur une chronologie avec dates de début/fin
 */

import { useMemo, useState } from 'react';
import { useObjects } from '@/hooks/useCRMObjects';
import { ObjectDefinition, CustomObject } from '@/types/crm-objects';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TimelineViewProps {
  projectId: string;
  objectType: string;
  definition: ObjectDefinition;
  queryOptions?: any;
  onEditRecord?: (recordId: string) => void;
}

export function TimelineView({
  projectId,
  objectType,
  definition,
  queryOptions,
  onEditRecord,
}: TimelineViewProps) {
  const { data: records = [], isLoading } = useObjects(projectId, objectType, queryOptions);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Trouver les champs date/datetime
  const dateFields = useMemo(
    () => definition.fields.filter((f) => f.type === 'date' || f.type === 'datetime'),
    [definition]
  );

  const startDateField = dateFields[0]; // Premier champ date = date de début
  const endDateField = dateFields[1]; // Deuxième champ date = date de fin (optionnel)

  // Calculer les jours du mois actuel
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Filtrer les records qui ont des dates dans le mois actuel
  const timelineRecords = useMemo(() => {
    if (!startDateField) return [];

    return records
      .filter((record) => {
        const startDate = record.data[startDateField.name];
        if (!startDate) return false;

        const date = parseISO(startDate as string);
        return (
          date >= startOfMonth(currentMonth) && date <= endOfMonth(currentMonth)
        );
      })
      .map((record) => {
        const startDate = parseISO(record.data[startDateField.name] as string);
        let endDate = startDate;

        if (endDateField && record.data[endDateField.name]) {
          endDate = parseISO(record.data[endDateField.name] as string);
        }

        return {
          ...record,
          startDate,
          endDate,
          duration: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        };
      });
  }, [records, currentMonth, startDateField, endDateField]);

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

  if (!startDateField) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucun champ date trouvé</h3>
          <p className="text-sm text-gray-400">
            Ajoutez un champ de type "date" ou "datetime" à cet objet pour utiliser la vue Timeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </h2>
            <p className="text-xs text-gray-400">
              {timelineRecords.length} événement(s)
            </p>
          </div>

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

      {/* Timeline Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Days Header */}
          <div className="flex border-b border-white/10 sticky top-0 bg-surface/80 backdrop-blur-sm z-10">
            <div className="w-48 flex-shrink-0 p-2 border-r border-white/10">
              <span className="text-xs font-semibold text-gray-400">Record</span>
            </div>
            {monthDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  'w-12 flex-shrink-0 p-2 border-r border-white/10 text-center',
                  isSameDay(day, new Date()) && 'bg-cyan-500/10'
                )}
              >
                <div className="text-xs font-medium text-white">{format(day, 'd')}</div>
                <div className="text-xs text-gray-400">{format(day, 'EEE', { locale: fr })}</div>
              </div>
            ))}
          </div>

          {/* Timeline Rows */}
          <div className="relative">
            {timelineRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun événement ce mois-ci
              </div>
            ) : (
              timelineRecords.map((record, idx) => {
                const dayOfMonth = record.startDate.getDate();
                const leftPosition = (dayOfMonth - 1) * 48; // 48px par jour
                const width = record.duration * 48;

                return (
                  <div key={record.id} className="flex border-b border-white/10 hover:bg-white/5">
                    <div className="w-48 flex-shrink-0 p-2 border-r border-white/10">
                      <button
                        onClick={() => onEditRecord?.(record.id)}
                        className="text-sm text-white hover:text-cyan-400 text-left truncate w-full"
                      >
                        {record.data[definition.fields[0]?.name] || 'Sans nom'}
                      </button>
                      <div className="text-xs text-gray-400 mt-1">
                        {format(record.startDate, 'd MMM', { locale: fr })}
                        {record.duration > 1 && ` - ${format(record.endDate, 'd MMM', { locale: fr })}`}
                      </div>
                    </div>

                    <div className="flex-1 relative h-16">
                      {/* Timeline Bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-8 bg-cyan-500/20 border-2 border-cyan-500 rounded-md cursor-pointer hover:bg-cyan-500/30 transition-colors flex items-center justify-center"
                        style={{
                          left: `${leftPosition}px`,
                          width: `${width}px`,
                        }}
                        onClick={() => onEditRecord?.(record.id)}
                      >
                        <span className="text-xs text-white font-medium truncate px-2">
                          {record.data[definition.fields[0]?.name]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
