/**
 * Sidebar pour la navigation entre les objets CRM
 * Liste les objets système et personnalisés
 */

import { useObjectDefinitions } from '@/hooks/useCRMObjects';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Search, Box, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import * as LucideIcons from 'lucide-react';

interface ObjectSidebarProps {
  projectId: string;
  currentObjectType?: string;
  onSelectObject: (objectType: string) => void;
  onCreateObject?: () => void;
  className?: string;
}

export function ObjectSidebar({
  projectId,
  currentObjectType,
  onSelectObject,
  onCreateObject,
  className,
}: ObjectSidebarProps) {
  const { data: definitions, isLoading } = useObjectDefinitions(projectId);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrer par recherche
  const filteredDefinitions = definitions?.filter(def =>
    def.singularLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    def.pluralLabel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Grouper par système vs personnalisé
  const systemObjects = filteredDefinitions?.filter(d => d.isSystem);
  const customObjects = filteredDefinitions?.filter(d => !d.isSystem);

  const renderObjectItem = (def: typeof definitions[0]) => {
    const isActive = currentObjectType === def.name;

    // Récupérer l'icône Lucide dynamiquement
    const IconComponent = def.icon
      ? (LucideIcons[def.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || Box
      : Box;

    return (
      <button
        key={def.id}
        onClick={() => onSelectObject(def.name)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
          'hover:bg-white/5',
          isActive && 'bg-cyan-500/10 border border-cyan-500/30'
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            isActive ? 'bg-cyan-500/20' : 'bg-white/5'
          )}
          style={isActive && def.color ? { backgroundColor: `${def.color}20`, borderColor: def.color } : undefined}
        >
          <IconComponent
            className={cn('w-4 h-4', isActive ? 'text-cyan-400' : 'text-gray-400')}
            style={isActive && def.color ? { color: def.color } : undefined}
          />
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className={cn(
            'text-sm font-medium truncate',
            isActive ? 'text-cyan-400' : 'text-gray-200'
          )}>
            {def.pluralLabel}
          </div>
          {def.generatedByAi && (
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-purple-400">Généré par IA</span>
            </div>
          )}
        </div>

        {isActive && (
          <div className="w-1 h-6 bg-cyan-500 rounded-full" />
        )}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className={cn('w-64 bg-surface/50 backdrop-blur-sm border-r border-white/5', className)}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-64 bg-surface/50 backdrop-blur-sm border-r border-white/5 flex flex-col', className)}>
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <h2 className="text-lg font-semibold text-white mb-3">Objets</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
      </div>

      {/* Objects List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-6">
          {/* Objets Système */}
          {systemObjects && systemObjects.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-3">
                Objets Système
              </h3>
              <div className="space-y-1">
                {systemObjects.map(renderObjectItem)}
              </div>
            </div>
          )}

          {/* Objets Personnalisés */}
          {customObjects && customObjects.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-3">
                Objets Personnalisés
              </h3>
              <div className="space-y-1">
                {customObjects.map(renderObjectItem)}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredDefinitions?.length === 0 && (
            <div className="text-center py-12 px-4">
              <Box className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-500">
                {searchQuery ? 'Aucun objet trouvé' : 'Aucun objet CRM'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer - Create Object */}
      {onCreateObject && (
        <div className="p-3 border-t border-white/5">
          <Button
            onClick={onCreateObject}
            variant="outline"
            className="w-full justify-start border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvel objet
          </Button>
        </div>
      )}
    </div>
  );
}
