import { useState, useEffect } from "react";
import { Eye, MousePointer, TrendingUp, Timer, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '@/hooks/useTranslation';

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
  const { language } = useTranslation();
  const isFr = language === 'fr';

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
      setError(err.message || (isFr ? 'Erreur lors du chargement des analytics' : 'Error loading analytics'));
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
    return date.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
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
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`h-full overflow-auto p-6 ${isDark ? 'bg-[#1f1f20]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">Analytics</h3>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className={`w-40 rounded-lg ${isDark ? 'bg-[#181818] border-slate-700 text-slate-200' : 'bg-white'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">{isFr ? 'Dernières 24h' : 'Last 24h'}</SelectItem>
            <SelectItem value="7d">{isFr ? '7 derniers jours' : 'Last 7 days'}</SelectItem>
            <SelectItem value="30d">{isFr ? '30 derniers jours' : 'Last 30 days'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-[#03A5C0]" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isFr ? 'Visiteurs' : 'Visitors'}</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.visitors}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <MousePointer className="w-4 h-4 text-slate-400" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isFr ? 'Pages vues' : 'Page views'}</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.pageviews}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isFr ? 'Vues/visite' : 'Views/visit'}</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.viewsPerVisit}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-slate-400" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isFr ? 'Durée visite' : 'Visit duration'}</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatDuration(data.metrics.visitDuration)}
          </div>
        </Card>

        <Card className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isFr ? 'Taux rebond' : 'Bounce rate'}</span>
          </div>
          <div className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.metrics.bounceRate}%
          </div>
        </Card>
      </div>

      {/* Note for empty data */}
      {data.timeSeries.length === 0 && data.metrics.visitors === 0 && (
        <div className={`p-3 rounded-lg mb-6 ${isDark ? 'bg-[#181818]' : 'bg-slate-100'}`}>
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {isFr
              ? 'Les données peuvent prendre jusqu\'à 24h pour apparaître après la première publication. Visitez votre site pour générer des données analytiques.'
              : 'Data may take up to 24 hours to appear after the first publish. Visit your site to generate analytics data.'}
          </span>
        </div>
      )}

      {/* Chart */}
      {data.timeSeries.length > 0 && (
        <Card className={`p-6 mb-6 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.timeSeries}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#03A5C0" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#03A5C0" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" stroke={isDark ? '#64748b' : '#94a3b8'} tickFormatter={formatDate} />
              <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1e293b' : '#fff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  color: isDark ? '#e2e8f0' : '#0f172a'
                }}
              />
              <Area type="monotone" dataKey="visitors" stroke="#03A5C0" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitors)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: isFr ? 'Sources' : 'Sources', data: data.lists.sources, suffix: '' },
          { title: 'Pages', data: data.lists.pages, suffix: '' },
          { title: isFr ? 'Pays' : 'Countries', data: data.lists.countries, suffix: '' },
          { title: isFr ? 'Appareils' : 'Devices', data: data.lists.devices, suffix: '%' },
        ].map((section) => (
          <Card key={section.title} className={`p-4 ${isDark ? 'bg-[#181818] border-slate-700' : 'bg-white'}`}>
            <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{section.title}</h4>
            <div className="space-y-1.5">
              {section.data.length > 0 ? section.data.slice(0, 5).map((item, idx) => (
                <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <span className={`truncate ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{item.label}</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}{section.suffix}</span>
                </div>
              )) : (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isFr ? 'Aucune donnée' : 'No data'}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
