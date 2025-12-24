/**
 * ModuleViewer - Affiche les widgets d'un module CRM dans un grid layout
 * Supporte les widgets prédéfinis ET les widgets générés dynamiquement par code
 * Avec drag & drop pour réorganiser les widgets
 */

import { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { crmGenerator } from '@/services/crmGenerator';
import { WIDGET_REGISTRY, isValidWidgetType } from './widgets/WidgetRegistry';
import { DynamicWidget } from './widgets/DynamicWidget';
import { WidgetContextMenu } from './WidgetContextMenu';
import { Loader2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ModuleViewerProps {
  moduleId: string;
}

interface Widget {
  id: string;
  widget_type: string;
  title: string;
  config: any;
  layout: { x: number; y: number; w: number; h: number };
  is_visible: boolean;
  is_code_generated?: boolean;
  generated_code?: string;
  code_version?: number;
  data_sources?: any;
  data?: any;
  display_order?: number;
}

interface SortableWidgetProps {
  widget: Widget;
  index: number;
  onRefresh: () => void;
}

/**
 * SortableWidget - Widget individuel avec drag & drop
 */
function SortableWidget({ widget, index, onRefresh }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const layout = widget.layout || { x: 0, y: 0, w: 12, h: 4 };

  // Style CSS Grid
  const gridStyle = {
    gridColumn: `span ${layout.w}`,
    gridRow: `span ${layout.h}`,
  };

  // Décider quel composant utiliser: DynamicWidget ou widget prédéfini
  let widgetContent;

  if (widget.is_code_generated && widget.generated_code) {
    // Widget généré dynamiquement par Claude
    widgetContent = (
      <DynamicWidget
        widgetId={widget.id}
        generatedCode={widget.generated_code}
        codeVersion={widget.code_version || 1}
        title={widget.title}
        config={widget.config}
        dataSources={widget.data_sources}
        onRegenerate={() => {
          console.log('Regenerate widget:', widget.id);
        }}
      />
    );
  } else {
    // Widget prédéfini du registry
    if (!isValidWidgetType(widget.widget_type)) {
      console.warn(`[ModuleViewer] Unknown widget type: ${widget.widget_type}`);
      return null;
    }

    const WidgetComponent = WIDGET_REGISTRY[widget.widget_type];
    widgetContent = (
      <WidgetComponent
        widgetId={widget.id}
        title={widget.title}
        config={widget.config}
        data={widget.data}
      />
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={{ ...gridStyle, ...style }}
      className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Drag Handle */}
      <button
        className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[#03A5C0]/10"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-[#03A5C0]" />
      </button>

      {/* Menu contextuel */}
      <WidgetContextMenu
        widgetId={widget.id}
        widgetTitle={widget.title}
        isCodeGenerated={widget.is_code_generated}
        onDuplicate={onRefresh}
        onDelete={onRefresh}
        onRegenerate={() => console.log('Regenerate', widget.id)}
        onEdit={() => console.log('Edit', widget.id)}
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        {widgetContent}
      </Suspense>
    </motion.div>
  );
}

export function ModuleViewer({ moduleId }: ModuleViewerProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Sensors pour drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (moduleId) {
      fetchWidgets();
    }
  }, [moduleId]);

  const fetchWidgets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await crmGenerator.getModuleWidgets(moduleId);
      // Trier par display_order
      const sortedData = data.sort(
        (a, b) => (a.display_order || 0) - (b.display_order || 0)
      );
      setWidgets(sortedData);
    } catch (err) {
      console.error('[ModuleViewer] Error fetching widgets:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);

      // Réorganiser localement
      const newWidgets = arrayMove(widgets, oldIndex, newIndex);
      setWidgets(newWidgets);

      // Mettre à jour l'ordre en base de données
      try {
        await crmGenerator.updateWidgetOrder(
          newWidgets.map((w, index) => ({ id: w.id, order: index }))
        );
      } catch (error) {
        console.error('[ModuleViewer] Error updating widget order:', error);
        // Restaurer l'ordre précédent en cas d'erreur
        fetchWidgets();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#03A5C0]" />
          <p className="text-sm text-muted-foreground">Chargement des widgets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-sm text-destructive mb-2">Erreur lors du chargement</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (widgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Aucun widget dans ce module
          </p>
          <p className="text-xs text-muted-foreground">
            Utilisez le chat pour ajouter des widgets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          {/* Grid CSS manuel (simplifié vs react-grid-layout pour Lovable-friendly) */}
          <div className="grid grid-cols-12 gap-4 auto-rows-[80px]">
            {widgets.map((widget, index) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                index={index}
                onRefresh={fetchWidgets}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
