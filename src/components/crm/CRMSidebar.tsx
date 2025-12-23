/**
 * CRMSidebar - Navigation entre les modules CRM
 */

import { useEffect, useState } from 'react';
import { crmGenerator } from '@/services/crmGenerator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Module {
  id: string;
  name: string;
  module_type: string;
  icon: string;
  display_order: number;
  is_active: boolean;
}

interface CRMSidebarProps {
  projectId: string;
  currentModuleId: string | null;
  onModuleSelect: (moduleId: string) => void;
}

export function CRMSidebar({ projectId, currentModuleId, onModuleSelect }: CRMSidebarProps) {
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchModules();
    }
  }, [projectId]);

  const fetchModules = async () => {
    setIsLoading(true);
    try {
      const data = await crmGenerator.getProjectModules(projectId);
      setModules(data);

      // Sélectionner le premier module par défaut si aucun n'est sélectionné
      if (data.length > 0 && !currentModuleId) {
        onModuleSelect(data[0].id);
      }
    } catch (error) {
      console.error('[CRMSidebar] Error fetching modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-64 h-full bg-card/80 backdrop-blur-sm border-r border-border/50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#03A5C0]" />
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-card/80 backdrop-blur-sm border-r border-border/50 flex flex-col shadow-lg">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Modules CRM</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/builder/${projectId}`)}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {modules.length} module{modules.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Modules List */}
      <ScrollArea className="flex-1">
        <nav className="px-3 py-4 space-y-1">
          {modules.map((module) => {
            const Icon = (Icons as any)[module.icon] || Icons.Box;
            const isActive = currentModuleId === module.id;

            return (
              <button
                key={module.id}
                onClick={() => onModuleSelect(module.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-[#03A5C0]/10 text-[#03A5C0] shadow-sm'
                    : 'text-foreground/80 hover:text-[#03A5C0] hover:bg-muted/50',
                  'focus:outline-none focus:ring-2 focus:ring-[#03A5C0]/50'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{module.name}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer - Add Module (TODO Phase 3) */}
      <div className="p-4 border-t border-border/30">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          style={{
            borderColor: '#03A5C0',
            color: '#03A5C0'
          }}
          disabled // TODO: Activer en Phase 3 avec chat
        >
          <Plus className="h-4 w-4" />
          Ajouter un module
        </Button>
      </div>
    </div>
  );
}
