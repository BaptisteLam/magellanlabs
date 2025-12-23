/**
 * LineChart Widget - Graphique en ligne/barres/aire
 * Utilise recharts pour les visualisations
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import type { WidgetProps } from './WidgetRegistry';

export default function LineChart({ widgetId, title, config }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const chartType = config.chartType || 'line'; // 'line' | 'area'
  const color = config.color || '#03A5C0';
  const xAxisKey = config.xAxis?.key || 'label';
  const yAxisKey = config.yAxis?.key || 'value';
  const yAxisLabel = config.yAxis?.label || '';
  const yAxisFormat = config.yAxis?.format || 'number';
  const showGrid = config.showGrid !== false;
  const smooth = config.smooth !== false;

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
        // Données mockées
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
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    return months.map((month, i) => ({
      [xAxisKey]: month,
      [yAxisKey]: Math.floor(Math.random() * 50000) + 10000 + (i * 2000)
    }));
  };

  const formatYAxis = (value: number) => {
    switch (yAxisFormat) {
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          notation: 'compact'
        }).format(value);

      case 'percent':
        return `${value}%`;

      case 'compact':
        return new Intl.NumberFormat('fr-FR', {
          notation: 'compact',
          maximumFractionDigits: 1
        }).format(value);

      default:
        return value.toLocaleString('fr-FR');
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const value = payload[0].value;

    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-1">
          {payload[0].payload[xAxisKey]}
        </p>
        <p className="text-sm font-bold" style={{ color: color }}>
          {formatYAxis(value)}
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

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4 h-full flex flex-col">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <div className="flex-1 flex items-center justify-center bg-card/50 border border-border/50 rounded-lg min-h-[250px]">
          <span className="text-sm text-muted-foreground">Aucune donnée</span>
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === 'area' ? AreaChart : RechartsLineChart;
  const DataComponent = chartType === 'area' ? Area : Line;

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {yAxisLabel && (
          <span className="text-sm text-muted-foreground">{yAxisLabel}</span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <DataComponent
              type={smooth ? 'monotone' : 'linear'}
              dataKey={yAxisKey}
              stroke={color}
              strokeWidth={2}
              fill={chartType === 'area' ? color : undefined}
              fillOpacity={chartType === 'area' ? 0.1 : undefined}
              dot={false}
              activeDot={{
                r: 6,
                fill: color,
                stroke: 'white',
                strokeWidth: 2
              }}
            />
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
