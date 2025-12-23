/**
 * BarChart Widget - Graphique en barres
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { WidgetProps } from './WidgetRegistry';

export default function BarChart({ widgetId, title, config }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const color = config.color || '#03A5C0';
  const xAxisKey = config.xAxis?.key || 'label';
  const yAxisKey = config.yAxis?.key || 'value';
  const yAxisFormat = config.yAxis?.format || 'number';
  const showGrid = config.showGrid !== false;

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

      if (widgetData?.data?.series) {
        setData(widgetData.data.series);
      } else {
        setData(generateMockData());
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setData(generateMockData());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = () => {
    const labels = ['Produit A', 'Produit B', 'Produit C', 'Produit D', 'Produit E'];
    return labels.map(label => ({
      [xAxisKey]: label,
      [yAxisKey]: Math.floor(Math.random() * 100) + 20
    }));
  };

  const formatYAxis = (value: number) => {
    if (yAxisFormat === 'currency') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        notation: 'compact'
      }).format(value);
    }
    return value.toLocaleString('fr-FR');
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-1">
          {payload[0].payload[xAxisKey]}
        </p>
        <p className="text-sm font-bold" style={{ color: color }}>
          {formatYAxis(payload[0].value)}
        </p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="flex-1 bg-muted/30 rounded-lg animate-pulse min-h-[250px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            )}
            <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatYAxis} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yAxisKey} fill={color} radius={[8, 8, 0, 0]} />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
