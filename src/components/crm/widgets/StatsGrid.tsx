/**
 * StatsGrid - Grille de statistiques (plusieurs KPIs)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { WidgetProps } from './WidgetRegistry';

interface Stat {
  label: string;
  value: number | string;
  trend?: string;
  icon?: string;
  format?: 'number' | 'currency' | 'percent';
}

export default function StatsGrid({ widgetId, title, config }: WidgetProps) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      if (widgetData?.data?.stats) {
        setStats(widgetData.data.stats);
      } else {
        setStats(generateMockStats());
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(generateMockStats());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockStats = (): Stat[] => {
    return [
      { label: 'Total Ventes', value: 45678, trend: '+12%', icon: 'ShoppingCart', format: 'currency' },
      { label: 'Nouveaux Clients', value: 234, trend: '+8%', icon: 'Users' },
      { label: 'Taux Conversion', value: 3.4, trend: '+0.5%', icon: 'TrendingUp', format: 'percent' },
      { label: 'Panier Moyen', value: 195, trend: '-2%', icon: 'DollarSign', format: 'currency' }
    ];
  };

  const formatValue = (value: number | string, format?: string) => {
    if (typeof value === 'string') return value;

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

  if (isLoading) {
    return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4 flex-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {stats.map((stat, i) => {
          const Icon = stat.icon ? (Icons as any)[stat.icon] : Icons.BarChart3;
          const isPositiveTrend = stat.trend?.startsWith('+');

          return (
            <div
              key={i}
              className="p-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: '#03A5C015',
                    color: '#03A5C0'
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <p className="text-2xl font-bold text-foreground mb-1">
                {formatValue(stat.value, stat.format)}
              </p>

              {stat.trend && (
                <div className="flex items-center gap-1">
                  {isPositiveTrend ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${isPositiveTrend ? 'text-green-500' : 'text-red-500'}`}>
                    {stat.trend}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
