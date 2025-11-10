import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from '@/components/ui/ai/task';
import { SiReact, SiTypescript, SiJson, SiJavascript } from '@icons-pack/react-simple-icons';
import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import type { AIEvent } from '@/types/agent';

// Helper pour obtenir l'icône et la couleur selon l'extension
function getFileIcon(path: string) {
  if (path.endsWith('/')) {
    return { Icon: Folder, color: '#94a3b8' };
  }
  if (path.endsWith('.tsx') || path.endsWith('.ts')) {
    return { Icon: SiTypescript, color: '#3178C6' };
  }
  if (path.endsWith('.jsx')) {
    return { Icon: SiReact, color: '#149ECA' };
  }
  if (path.endsWith('.js')) {
    return { Icon: SiJavascript, color: '#F7DF1E' };
  }
  if (path.endsWith('.json')) {
    return { Icon: SiJson, color: '#000000' };
  }
  if (path.endsWith('.css')) {
    return { Icon: SiReact, color: '#1572B6' };
  }
  return { Icon: SiReact, color: '#149ECA' };
}

// Détecte le thème d'une tâche à partir du contenu
function detectTaskTheme(content: string): string {
  const lower = content.toLowerCase();
  
  if (lower.includes('initializing') || lower.includes('installing') || lower.includes('configuring')) {
    return 'Setting up project';
  }
  if (lower.includes('scanning') || lower.includes('found') || lower.includes('analyzing')) {
    return 'Analyzing components';
  }
  if (lower.includes('compiling') || lower.includes('bundling') || lower.includes('optimizing') || lower.includes('build')) {
    return 'Building project';
  }
  if (lower.includes('intent') || lower.includes('action')) {
    return 'Analyzing request';
  }
  
  return content.split(':')[0] || 'Processing';
}

interface TaskGroup {
  title: string;
  items: string[];
  status: 'pending' | 'in_progress' | 'completed';
}

interface VisibleState {
  sections: number;
  itemsPerSection: { [key: number]: number };
}

export default function AiTaskList({ events }: { events: AIEvent[] }) {
  const [tasks, setTasks] = useState<TaskGroup[]>([]);
  const [visible, setVisible] = useState<VisibleState>({ sections: 0, itemsPerSection: {} });

  // Regroupe les événements par thème
  useEffect(() => {
    const grouped: { [title: string]: { items: string[]; status: 'pending' | 'in_progress' | 'completed' } } = {};
    
    events.forEach((e) => {
      if (e.type === 'status' && e.content) {
        const title = detectTaskTheme(e.content);
        const detail = e.content.split(':')[1]?.trim() || e.content;
        
        if (!grouped[title]) {
          grouped[title] = { items: [], status: 'in_progress' };
        }
        if (detail && !grouped[title].items.includes(detail)) {
          grouped[title].items.push(detail);
        }
      }
      
      if (e.type === 'log' && e.content) {
        if (!grouped['Build Process']) {
          grouped['Build Process'] = { items: [], status: 'in_progress' };
        }
        grouped['Build Process'].items.push(e.content);
      }
      
      if (e.type === 'code_update' && e.path) {
        if (!grouped['Generating code']) {
          grouped['Generating code'] = { items: [], status: 'in_progress' };
        }
        grouped['Generating code'].items.push(`Updated ${e.path}`);
      }

      if (e.type === 'intent') {
        const title = 'Analyzing request';
        if (!grouped[title]) {
          grouped[title] = { items: [], status: 'completed' };
        }
        if (e.action) {
          grouped[title].items.push(`Detected action: ${e.action}`);
        }
        if (e.description) {
          grouped[title].items.push(e.description);
        }
      }

      if (e.type === 'complete') {
        Object.keys(grouped).forEach(key => {
          grouped[key].status = 'completed';
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

  // Révélation progressive des sections et items
  useEffect(() => {
    if (tasks.length === 0) {
      setVisible({ sections: 0, itemsPerSection: {} });
      return;
    }

    // Révéler les sections progressivement
    let sectionIndex = 0;
    const sectionInterval = setInterval(() => {
      if (sectionIndex < tasks.length) {
        setVisible(prev => ({
          ...prev,
          sections: sectionIndex + 1,
          itemsPerSection: { ...prev.itemsPerSection, [sectionIndex]: 0 }
        }));
        
        // Révéler les items de cette section
        const currentSection = sectionIndex;
        let itemIndex = 0;
        const itemInterval = setInterval(() => {
          if (itemIndex < tasks[currentSection].items.length) {
            setVisible(prev => ({
              ...prev,
              itemsPerSection: { ...prev.itemsPerSection, [currentSection]: itemIndex + 1 }
            }));
            itemIndex++;
          } else {
            clearInterval(itemInterval);
          }
        }, 250 + Math.random() * 100); // 250-350ms

        sectionIndex++;
      } else {
        clearInterval(sectionInterval);
      }
    }, 900 + Math.random() * 200); // 900-1100ms

    return () => clearInterval(sectionInterval);
  }, [tasks]);

  if (!tasks.length) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 shadow-sm max-w-2xl">
      <div className="space-y-2">
        {tasks.slice(0, visible.sections).map((task, i) => (
          <Task key={i} defaultOpen>
            <TaskTrigger 
              title={task.title} 
              status={task.status === 'completed' ? 'complete' : task.status === 'pending' ? 'pending' : 'running'} 
            />
            <TaskContent>
              {task.items.slice(0, visible.itemsPerSection[i] || 0).map((text, j) => {
                const fileMatch = text.match(/(src\/[^\s]+\.(tsx|ts|jsx|js|json|css))/);
                const file = fileMatch ? fileMatch[1] : null;
                const { Icon, color } = file ? getFileIcon(file) : { Icon: null, color: '' };

                return (
                  <TaskItem 
                    key={j}
                    className={task.status === 'pending' ? 'animate-pulse opacity-80' : ''}
                  >
                    {file && Icon ? (
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        {text.replace(file, '')}
                        <TaskItemFile>
                          <Icon className="size-3" color={color} />
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
    </div>
  );
}

/**
 * Usage:
 * 
 * const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
 * 
 * // Dans ton handler de streaming NDJSON:
 * const event = JSON.parse(line);
 * setAiEvents(prev => [...prev, event]);
 * 
 * // Dans le rendu:
 * <AiTaskList events={aiEvents} />
 */
