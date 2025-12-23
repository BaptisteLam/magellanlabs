/**
 * CalendarWidget - Calendrier pour rendez-vous et événements
 */

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import type { WidgetProps } from './WidgetRegistry';

export default function CalendarWidget({ widgetId, title, config, data }: WidgetProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const events = data?.events || [];

  // Récupérer les événements du jour sélectionné
  const selectedDateEvents = events.filter((event: any) => {
    const eventDate = new Date(event.date);
    return date && eventDate.toDateString() === date.toDateString();
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      <div className="flex-1 flex gap-4">
        {/* Calendrier */}
        <div className="flex-shrink-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border border-border/50"
          />
        </div>

        {/* Liste des événements du jour */}
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {date ? date.toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Sélectionnez une date'}
          </h4>

          {selectedDateEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              Aucun événement ce jour
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map((event: any, i: number) => (
                <div
                  key={i}
                  className="p-3 bg-card/50 border border-border/50 rounded-lg space-y-1"
                >
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm">{event.title}</p>
                    <Badge variant="secondary" className="text-xs">
                      {event.time}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
