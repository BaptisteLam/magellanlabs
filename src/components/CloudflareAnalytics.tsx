import { useState, useEffect } from "react";
import { BarChart3, Clock, TrendingUp, Eye, MousePointer, Timer, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface CloudflareAnalyticsProps {
  sessionId: string;
  isDark: boolean;
}

interface AnalyticsData {
  timeSeries: Array<{
    date: string;
    visitors: number;
    pageviews: number;
    requests: number;
  }>;
  metrics: {
    visitors: number;
    pageviews: number;
    viewsPerVisit: number;
    visitDuration: number;
    bounceRate: number;
  };
  lists: {
    sources: Array<{ label: string; value: number }>;
    pages: Array<{ label: string; value: number }>;
    countries: Array<{ label: string; value: number }>;
    devices: Array<{ label: string; value: number }>;
  };
  last_updated: string;
}

export default function CloudflareAnalytics({ sessionId, isDark }: CloudflareAnalyticsProps) {
  const [period, setPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVisitors, setCurrentVisitors] = useState(1);

  useEffect(() => {
    fetchAnalytics();
  }, [period, sessionId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: responseData, error: functionError } = await supabase.functions.invoke('get-cloudflare-analytics', {
        body: {
          session_id: sessionId,
          period: period,
        },
      });

      if (functionError) throw functionError;
      setData(responseData);
    } catch (err: any) {
      console.error('Error fetching Cloudflare analytics:', err);
      setError(err.message || 'Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#03A5C0]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`h-full overflow-auto p-6 ${isDark ? 'bg-[#1f1f20]' : 'bg-slate-50'}`}>
      {/* Header with current visitors and period selector */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {currentVisitors} current visitor{currentVisitors > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className={`w-40 rounded-lg ${isDark ? 'bg-[#181818] border-slate-700 text-slate-200' : 'bg-white'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'} ${period === '7d' ? 'border-[#03A5C0]' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-[#03A5C0]" />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Visitors</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.visitors}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <MousePointer className="w-4 h-4 text-slate-400" />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pageviews</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.pageviews}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Views Per Visit</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.viewsPerVisit}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-slate-400" />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Visit Duration</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatDuration(data.metrics.visitDuration)}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bounce Rate</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.bounceRate}%
          </div>
        </Card>
      </div>

      {/* Note */}
      {data.timeSeries.length > 0 && (
        <div className={`p-3 rounded-lg mb-6 flex items-start gap-2 ${isDark ? 'bg-[#181818]' : 'bg-slate-100'}`}>
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <strong>Note:</strong> Analytics data provided by Cloudflare Web Analytics.
          </span>
        </div>
      )}

      {/* Chart */}
      <Card className={`p-6 mb-6 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.timeSeries}>
            <defs>
              <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#03A5C0" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#03A5C0" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
            <XAxis 
              dataKey="date" 
              stroke={isDark ? '#64748b' : '#94a3b8'}
              tickFormatter={formatDate}
            />
            <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#1e293b' : '#fff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                borderRadius: '8px',
                color: isDark ? '#e2e8f0' : '#0f172a'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="visitors" 
              stroke="#03A5C0" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorVisitors)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Lists Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Source */}
        <Card className={`p-6 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Source
          </h3>
          <div className="space-y-2">
            {data.lists.sources.length > 0 ? (
              data.lists.sources.map((source, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}
                >
                  <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>{source.label}</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{source.value}</span>
                </div>
              ))
            ) : (
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No data available</p>
            )}
          </div>
        </Card>

        {/* Page */}
        <Card className={`p-6 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Page
          </h3>
          <div className="space-y-2">
            {data.lists.pages.length > 0 ? (
              data.lists.pages.slice(0, 10).map((page, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}
                >
                  <span className={`text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{page.label}</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{page.value}</span>
                </div>
              ))
            ) : (
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No data available</p>
            )}
          </div>
        </Card>

        {/* Country */}
        <Card className={`p-6 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Country
          </h3>
          <div className="space-y-2">
            {data.lists.countries.length > 0 ? (
              data.lists.countries.map((country, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}
                >
                  <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>{country.label}</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{country.value}</span>
                </div>
              ))
            ) : (
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No data available</p>
            )}
          </div>
        </Card>

        {/* Device */}
        <Card className={`p-6 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Device
          </h3>
          <div className="space-y-2">
            {data.lists.devices.length > 0 ? (
              data.lists.devices.map((device, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}
                >
                  <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>{device.label}</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{device.value}%</span>
                </div>
              ))
            ) : (
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No data available</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
