import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from '@/components/ui/ai/task';
import { SiReact, SiTypescript, SiJson } from '@icons-pack/react-simple-icons';
import { useEffect, useState } from 'react';
import type { AIEvent } from '@/types/agent';

interface TaskGroup {
  title: string;
  items: string[];
  status: 'pending' | 'running' | 'complete';
}

export default function AiTaskList({ events }: { events: AIEvent[] }) {
  const [tasks, setTasks] = useState<TaskGroup[]>([]);

  // Regroupe les "status" et "code_update" par thème
  useEffect(() => {
    const grouped: { [title: string]: { items: string[]; status: 'pending' | 'running' | 'complete' } } = {};
    
    events.forEach((e) => {
      if (e.type === 'status') {
        const title = e.content?.includes('...') 
          ? e.content.split('...')[0] 
          : e.content?.split(':')[0] || 'Processing';
        const detail = e.content?.split(':')[1]?.trim() || e.content;
        
        if (!grouped[title]) {
          grouped[title] = { items: [], status: 'running' };
        }
        if (detail) {
          grouped[title].items.push(detail);
        }
      }
      
      if (e.type === 'code_update' && e.path) {
        if (!grouped['Génération du code']) {
          grouped['Génération du code'] = { items: [], status: 'running' };
        }
        grouped['Génération du code'].items.push(`Mise à jour de ${e.path}`);
      }

      if (e.type === 'intent') {
        const action = e.action || 'unknown';
        const title = 'Analyse de la demande';
        if (!grouped[title]) {
          grouped[title] = { items: [], status: 'complete' };
        }
        grouped[title].items.push(`Action détectée: ${action}`);
        if (e.description) {
          grouped[title].items.push(e.description);
        }
      }

      if (e.type === 'complete') {
        // Marquer toutes les tâches comme complètes
        Object.keys(grouped).forEach(key => {
          grouped[key].status = 'complete';
        });
      }
    });

    const formatted = Object.entries(grouped).map(([title, { items, status }]) => ({
      title,
      items,
      status,
    }));
    
    setTasks(formatted);
  }, [events]);

  if (!tasks.length) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-foreground">Tâches IA</h3>
      {tasks.map((task, i) => (
        <Task key={i} defaultOpen={i === tasks.length - 1}>
          <TaskTrigger title={task.title} status={task.status} />
          <TaskContent>
            {task.items.map((text, j) => {
              const fileMatch = text.match(/src\/\S+\.(tsx|ts|json|js|css)/);
              const file = fileMatch ? fileMatch[0] : null;
              const Icon =
                file?.endsWith('.tsx') || file?.endsWith('.ts')
                  ? SiTypescript
                  : file?.endsWith('.json')
                  ? SiJson
                  : SiReact;

              return (
                <TaskItem key={j}>
                  {file ? (
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      {text.replace(file, '')}
                      <TaskItemFile>
                        <Icon className="size-3" color="#149ECA" />
                        <span>{file}</span>
                      </TaskItemFile>
                    </span>
                  ) : (
                    text
                  )}
                </TaskItem>
              );
            })}
          </TaskContent>
        </Task>
      ))}
    </div>
  );
}
