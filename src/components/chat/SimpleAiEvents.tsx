import { FileText, Edit, Lightbulb, Loader, CheckCircle } from 'lucide-react';
import type { GenerationEvent } from '@/types/agent';

interface SimpleAiEventsProps {
  events: GenerationEvent[];
  isDark?: boolean;
}

export function SimpleAiEvents({ events, isDark = false }: SimpleAiEventsProps) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col space-y-2">
      {events.map((event, idx) => (
        <div key={idx} className="flex items-center gap-2 text-muted-foreground text-sm">
          {event.type === 'thought' && event.duration !== undefined && event.duration > 0 && (
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#03A5C0]" />
              <span>Thought for {event.duration}s</span>
            </div>
          )}
          
          {event.type === 'read' && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#03A5C0]" />
              <span>Read</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{
                backgroundColor: isDark ? '#181818' : '#f1f5f9',
                color: isDark ? '#94a3b8' : '#64748b'
              }}>
                {event.message}
              </span>
            </div>
          )}
          
          {event.type === 'edit' && (
            <div className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-[#03A5C0]" />
              <span>Edited</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{
                backgroundColor: isDark ? '#181818' : '#f1f5f9',
                color: isDark ? '#94a3b8' : '#64748b'
              }}>
                {event.file}
              </span>
            </div>
          )}
          
          {event.type === 'complete' && (
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span>{event.message}</span>
            </div>
          )}
          
          {event.type === 'error' && (
            <div className="flex items-center gap-2 text-red-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{event.message}</span>
            </div>
          )}
        </div>
      ))}

      {/* Animation de pensée en cours */}
      {!events.some(e => e.type === 'complete' || e.type === 'error') && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
          <Loader className="w-4 h-4 animate-spin text-[#03A5C0]" />
          <span>Thinking...</span>
        </div>
      )}
    </div>
  );
}
