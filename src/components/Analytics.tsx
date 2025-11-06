import { useState, useEffect } from "react";
import { BarChart3, Globe, FileText, Smartphone, Clock, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import GAConfigDialog from "./GAConfigDialog";

interface AnalyticsProps {
  isPublished: boolean;
  isDark: boolean;
  gaPropertyId?: string;
  websiteId?: string;
}

interface AnalyticsData {
  visits: number;
  by_country: Array<{ country: string; views: number }>;
  by_page: Array<{ path: string; views: number }>;
  by_device: Array<{ device: string; views: number }>;
  last_updated: string;
}

export default function Analytics({ isPublished, isDark, gaPropertyId, websiteId }: AnalyticsProps) {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [localGaPropertyId, setLocalGaPropertyId] = useState<string | null>(gaPropertyId || null);

  // Recharger le gaPropertyId depuis la base de données périodiquement
  useEffect(() => {
    if (!websiteId || localGaPropertyId) return;
    
    const loadGaPropertyId = async () => {
      const { data: websiteData } = await supabase
        .from('websites')
        .select('ga_property_id')
        .eq('id', websiteId)
        .single();
      
      if (websiteData?.ga_property_id) {
        setLocalGaPropertyId(websiteData.ga_property_id);
      }
    };
    
    loadGaPropertyId();
    
    // Vérifier toutes les 3 secondes si le gaPropertyId a été configuré
    const interval = setInterval(loadGaPropertyId, 3000);
    return () => clearInterval(interval);
  }, [websiteId, localGaPropertyId]);

  const COLORS = ['#03A5C0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  useEffect(() => {
    if (isPublished && localGaPropertyId) {
      fetchAnalytics();
    }
  }, [period, localGaPropertyId, isPublished]);

  useEffect(() => {
    if (data?.last_updated) {
      const updateInterval = setInterval(() => {
        const diff = Date.now() - new Date(data.last_updated).getTime();
        const minutes = Math.floor(diff / 60000);
        setLastUpdateTime(minutes === 0 ? "à l'instant" : `il y a ${minutes} min`);
      }, 10000);
      return () => clearInterval(updateInterval);
    }
  }, [data?.last_updated]);

  const fetchAnalytics = async () => {
    if (!localGaPropertyId) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: responseData, error: functionError } = await supabase.functions.invoke('get-analytics', {
        body: {
          property_id: localGaPropertyId,
          period: period,
        },
      });

      if (functionError) throw functionError;
      setData(responseData);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSuccess = (propertyId: string, measurementId: string) => {
    setLocalGaPropertyId(propertyId);
    setShowConfigDialog(false);
  };

  if (!isPublished) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            <BarChart3 className="w-8 h-8 text-[#03A5C0]" />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
            Analytics non disponibles
          </h3>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Pour voir vos analytics, il faut publier votre site.
          </p>
        </div>
      </div>
    );
  }

  if (!localGaPropertyId && websiteId) {
    return (
      <>
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isDark ? 'bg-slate-800' : 'bg-slate-100'
            }`}>
              <BarChart3 className="w-8 h-8 text-[#03A5C0]" />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
              Configuration Google Analytics requise
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Configurez votre compte Google Analytics 4 pour voir les statistiques de votre site.
            </p>
            <Button onClick={() => setShowConfigDialog(true)} className="gap-2">
              <Settings className="w-4 h-4" />
              Configurer GA4
            </Button>
          </div>
        </div>
        <GAConfigDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          websiteId={websiteId}
          onSuccess={handleConfigSuccess}
        />
      </>
    );
  }

  return (
    <div className={`h-full overflow-auto p-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header with period selector and config button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
            Analytics
          </h2>
          {lastUpdateTime && (
            <div className={`flex items-center gap-2 mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <Clock className="w-3 h-3" />
              <span>Dernière actualisation : {lastUpdateTime}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {websiteId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfigDialog(true)}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurer
            </Button>
          )}
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className={`w-40 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
              <SelectItem value="90d">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <GAConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        websiteId={websiteId || ''}
        onSuccess={handleConfigSuccess}
      />

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#03A5C0]"></div>
        </div>
      )}

      {error && (
        <Card className={isDark ? 'bg-slate-900 border-slate-800' : ''}>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          {data.visits === 0 ? (
            <Card className={isDark ? 'bg-slate-900 border-slate-800' : ''}>
              <CardContent className="pt-6">
                <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Aucune donnée pour cette période
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {/* Widget 1: Total Visits */}
              <Card className={isDark ? 'bg-slate-900 border-slate-800' : ''}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-slate-200' : ''}`}>
                    <BarChart3 className="w-5 h-5 text-[#03A5C0]" />
                    Visites totales
                  </CardTitle>
                  <p className={`text-3xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                    {data.visits.toLocaleString()}
                  </p>
                </CardHeader>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Widget 2: By Country */}
                <Card className={isDark ? 'bg-slate-900 border-slate-800' : ''}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-slate-200' : ''}`}>
                      <Globe className="w-5 h-5 text-[#03A5C0]" />
                      Pays les plus actifs
                    </CardTitle>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Total: {data.by_country.reduce((sum, c) => sum + c.views, 0).toLocaleString()} vues
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.by_country.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis type="number" stroke={isDark ? '#94a3b8' : '#64748b'} />
                        <YAxis dataKey="country" type="category" width={100} stroke={isDark ? '#94a3b8' : '#64748b'} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            color: isDark ? '#e2e8f0' : '#0f172a'
                          }}
                        />
                        <Bar dataKey="views" fill="#03A5C0" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Widget 3: By Page */}
                <Card className={isDark ? 'bg-slate-900 border-slate-800' : ''}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-slate-200' : ''}`}>
                      <FileText className="w-5 h-5 text-[#03A5C0]" />
                      Pages les plus visitées
                    </CardTitle>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Total: {data.by_page.reduce((sum, p) => sum + p.views, 0).toLocaleString()} vues
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.by_page.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="path" stroke={isDark ? '#94a3b8' : '#64748b'} />
                        <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            color: isDark ? '#e2e8f0' : '#0f172a'
                          }}
                        />
                        <Bar dataKey="views" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Widget 4: By Device */}
              <Card className={isDark ? 'bg-slate-900 border-slate-800' : ''}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-slate-200' : ''}`}>
                    <Smartphone className="w-5 h-5 text-[#03A5C0]" />
                    Répartition par appareil
                  </CardTitle>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Total: {data.by_device.reduce((sum, d) => sum + d.views, 0).toLocaleString()} vues
                  </p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.by_device}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ device, percent }) => `${device}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="views"
                      >
                        {data.by_device.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#1e293b' : '#fff',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          color: isDark ? '#e2e8f0' : '#0f172a'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
