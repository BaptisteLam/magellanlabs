/**
 * PieChart Widget - Graphique circulaire
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import type { WidgetProps } from './WidgetRegistry';

const COLORS = ['#03A5C0', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6'];

export default function PieChart({ widgetId, title, config }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const labelKey = config.labelKey || 'name';
  const valueKey = config.valueKey || 'value';

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
      console.error('Error fetching pie chart data:', error);
      setData(generateMockData());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = () => {
    return [
      { name: 'Catégorie A', value: 35 },
      { name: 'Catégorie B', value: 25 },
      { name: 'Catégorie C', value: 20 },
      { name: 'Catégorie D', value: 15 },
      { name: 'Autre', value: 5 }
    ];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{data.name}</p>
        <p className="text-sm font-bold" style={{ color: data.payload.fill }}>
          {data.value}%
        </p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="flex-1 bg-muted/30 rounded-full animate-pulse min-h-[250px] max-w-[250px] mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => `${entry[labelKey]}: ${entry[valueKey]}%`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
