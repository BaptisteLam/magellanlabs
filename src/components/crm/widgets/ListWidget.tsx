/**
 * ListWidget - Liste simple d'éléments
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WidgetProps } from './WidgetRegistry';

export default function ListWidget({ widgetId, title, config }: WidgetProps) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showStatus = config.showStatus !== false;
  const showBadge = config.showBadge === true;

  useEffect(() => {
    fetchData();
  }, [widgetId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: widgetData, error } = await supabase
        .from('widget_data')
        .select('data')
        .eq('widget_id', widgetId)
        .maybeSingle();

      if (error) throw error;

      if (widgetData?.data?.items) {
        setItems(widgetData.data.items);
      } else {
        setItems(generateMockItems());
      }
    } catch (error) {
      console.error('Error fetching list data:', error);
      setItems(generateMockItems());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockItems = () => {
    return [
      { id: 1, title: 'Exemple d\'élément 1', status: 'completed', badge: 'Important' },
      { id: 2, title: 'Exemple d\'élément 2', status: 'pending', badge: 'Normal' },
      { id: 3, title: 'Exemple d\'élément 3', status: 'pending', badge: 'Urgent' },
      { id: 4, title: 'Exemple d\'élément 4', status: 'completed' },
      { id: 5, title: 'Exemple d\'élément 5', status: 'pending' }
    ];
  };

  if (isLoading) {
    return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className="text-sm text-muted-foreground">{items.length} élément(s)</span>
      </div>

      <div className="flex-1 space-y-2 overflow-auto">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Aucun élément
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors"
            >
              {showStatus && (
                <div className="flex-shrink-0">
                  {item.status === 'completed' ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              )}

              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>

              {showBadge && item.badge && (
                <Badge
                  variant={item.badge === 'Urgent' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {item.badge}
                </Badge>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
