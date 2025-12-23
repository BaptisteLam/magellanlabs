/**
 * KPICard Widget - Carte de métrique avec icône et tendance
 * Affiche une valeur principale avec évolution
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { WidgetProps } from './WidgetRegistry';

export default function KPICard({ widgetId, title, config }: WidgetProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const iconName = config.icon || 'BarChart3';
  const color = config.color || '#03A5C0';
  const format = config.format || 'number'; // 'number' | 'currency' | 'percent'

  useEffect(() => {
    fetchData();
  }, [widgetId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: widgetData, error } = await supabase
        .from('widget_data' as any)
        .select('data')
        .eq('widget_id', widgetId)
        .maybeSingle();

      if (error) throw error;

      const wd = widgetData as any;
      if (wd?.data) {
        setData(wd.data);
      } else {
        // Données mockées
        setData(generateMockData(format));
      }
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      setData(generateMockData(format));
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = (fmt: string) => {
    const baseValue = fmt === 'currency' ? 45000 : fmt === 'percent' ? 67 : 124;
    const trend = Math.random() > 0.5 ? '+' : '-';
    const trendValue = Math.floor(Math.random() * 20) + 1;

    return {
      value: baseValue,
      trend: `${trend}${trendValue}%`,
      period: 'ce mois',
      previous_value: baseValue - (trend === '+' ? trendValue : -trendValue)
    };
  };

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);

      case 'percent':
        return `${value}%`;

      default:
        return value.toLocaleString('fr-FR');
    }
  };

  const getTrendIcon = () => {
    if (!data?.trend) return null;

    const isPositive = data.trend.startsWith('+');
    const isNeutral = data.trend.startsWith('0');

    if (isNeutral) {
      return <Minus className="w-4 h-4 text-muted-foreground" />;
    }

    return isPositive ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getTrendColor = () => {
    if (!data?.trend) return 'text-muted-foreground';

    const isPositive = data.trend.startsWith('+');
    const isNeutral = data.trend.startsWith('0');

    if (isNeutral) return 'text-muted-foreground';
    return isPositive ? 'text-green-500' : 'text-red-500';
  };

  // Récupérer l'icône dynamiquement
  const Icon = (Icons as any)[iconName] || Icons.BarChart3;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-between p-4 bg-card/50 border border-border/50 rounded-xl animate-pulse">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 bg-muted/50 rounded" />
          <div className="h-8 w-16 bg-muted/50 rounded" />
          <div className="h-3 w-20 bg-muted/50 rounded" />
        </div>
        <div className="w-12 h-12 bg-muted/50 rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-card/50 border border-border/50 rounded-xl">
        <span className="text-sm text-muted-foreground">Aucune donnée</span>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-between p-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      {/* Valeur et tendance */}
      <div className="space-y-2 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">
          {formatValue(data.value)}
        </p>

        {/* Tendance */}
        {data.trend && (
          <div className="flex items-center gap-1.5">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {data.trend}
            </span>
            {data.period && (
              <span className="text-sm text-muted-foreground">
                {data.period}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Icône */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `${color}15`,
          color: color
        }}
      >
        <Icon className="w-7 h-7" />
      </div>
    </div>
  );
}
