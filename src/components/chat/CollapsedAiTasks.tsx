import { useState } from 'react';
import { SimpleAiEvents } from './SimpleAiEvents';
import type { GenerationEvent } from '@/types/agent';

interface CollapsedAiTasksProps {
  events: GenerationEvent[];
  isDark?: boolean;
}

export function CollapsedAiTasks({ events, isDark = false }: CollapsedAiTasksProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length === 0) return null;

  // Compter les edits
  const editCount = events.filter(e => e.type === 'edit').length;

  return (
    <div className="relative flex w-full flex-col">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:border-accent rounded-md absolute right-0 top-0 z-10 flex h-6 items-center justify-center bg-background px-1.5 py-1 text-base font-normal transition-all duration-300 ease-out md:text-sm"
        aria-label={isExpanded ? "Collapse tool uses" : "Expand tool uses"}
        style={{
          borderColor: isDark ? '#333' : '#e2e8f0',
          backgroundColor: isDark ? '#1F1F20' : '#ffffff'
        }}
      >
        {isExpanded ? 'Hide all' : 'Show all'}
      </button>
      
      <div 
        className="relative overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: isExpanded ? 'auto' : '24px' }}
      >
        <div className={isExpanded ? 'flex flex-col' : 'flex h-full items-end'}>
          {!isExpanded ? (
            <div className="flex h-6 items-center gap-1.5 whitespace-nowrap text-base font-medium text-muted-foreground md:text-sm">
              <div className="mb-px flex shrink-0 items-center">
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
              </div>
              <span className="flex-shrink-0 font-normal">
                {editCount > 0 ? `${editCount} edit${editCount > 1 ? 's' : ''} made` : 'Generation completed'}
              </span>
            </div>
          ) : (
            <div className="pt-2">
              <SimpleAiEvents events={events} isDark={isDark} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
