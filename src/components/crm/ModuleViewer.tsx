/**
 * ModuleViewer - Affiche les widgets d'un module CRM dans un grid layout
 * Supporte les widgets prédéfinis ET les widgets générés dynamiquement par code
 */

import { useEffect, useState, Suspense } from 'react';
import { crmGenerator } from '@/services/crmGenerator';
import { WIDGET_REGISTRY, isValidWidgetType } from './widgets/WidgetRegistry';
import { DynamicWidget } from './widgets/DynamicWidget';
import { Loader2 } from 'lucide-react';

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
}

export function ModuleViewer({ moduleId }: ModuleViewerProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
      setWidgets(data);
    } catch (err) {
      console.error('[ModuleViewer] Error fetching widgets:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
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
      {/* Grid CSS manuel (simplifié vs react-grid-layout pour Lovable-friendly) */}
      <div className="grid grid-cols-12 gap-4 auto-rows-[80px]">
        {widgets.map((widget) => {
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
                  // TODO: Implémenter la régénération via chat
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
            <div
              key={widget.id}
              style={gridStyle}
              className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                {widgetContent}
              </Suspense>
            </div>
          );
        })}
      </div>
    </div>
  );
}
