/**
 * VisualWidgetEditor - Éditeur visuel WYSIWYG pour créer des widgets sans code
 * Design : Respecte la DA Magellan (cyan #03A5C0, glassmorphism)
 * Architecture : 3 panels (Components | Canvas | Properties)
 */

import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table2,
  Calendar,
  TrendingUp,
  Grid3x3,
  List,
  X,
  Save,
  Eye,
  Sparkles,
  Palette,
  Settings,
  Database as DatabaseIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface VisualWidgetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  onWidgetCreated?: (widgetId: string) => void;
}

interface WidgetComponent {
  id: string;
  type: 'chart' | 'kpi' | 'table' | 'calendar' | 'list';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

interface WidgetConfig {
  type: string;
  title: string;
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  dataSource?: string;
  color: string;
  layout: {
    w: number;
    h: number;
  };
  showLegend?: boolean;
  animated?: boolean;
  columns?: Array<{ key: string; label: string; type: string }>;
}

const AVAILABLE_COMPONENTS: WidgetComponent[] = [
  {
    id: 'bar-chart',
    type: 'chart',
    icon: BarChart3,
    label: 'Graphique Barres',
    description: 'Bar chart pour comparer des valeurs',
  },
  {
    id: 'line-chart',
    type: 'chart',
    icon: LineChartIcon,
    label: 'Graphique Ligne',
    description: 'Line chart pour évolutions temporelles',
  },
  {
    id: 'pie-chart',
    type: 'chart',
    icon: PieChartIcon,
    label: 'Graphique Circulaire',
    description: 'Pie chart pour répartitions',
  },
  {
    id: 'kpi-card',
    type: 'kpi',
    icon: TrendingUp,
    label: 'KPI Card',
    description: 'Carte métrique avec valeur et tendance',
  },
  {
    id: 'data-table',
    type: 'table',
    icon: Table2,
    label: 'Tableau',
    description: 'Tableau de données avec filtres',
  },
  {
    id: 'calendar',
    type: 'calendar',
    icon: Calendar,
    label: 'Calendrier',
    description: 'Calendrier pour événements',
  },
  {
    id: 'stats-grid',
    type: 'kpi',
    icon: Grid3x3,
    label: 'Grille KPI',
    description: 'Grille de plusieurs KPI',
  },
  {
    id: 'list',
    type: 'list',
    icon: List,
    label: 'Liste',
    description: 'Liste simple d\'éléments',
  },
];

export function VisualWidgetEditor({
  open,
  onOpenChange,
  moduleId,
  onWidgetCreated,
}: VisualWidgetEditorProps) {
  const [selectedComponent, setSelectedComponent] = useState<WidgetComponent | null>(null);
  const [config, setConfig] = useState<WidgetConfig>({
    type: 'bar-chart',
    title: 'Mon Widget',
    color: '#03A5C0',
    layout: { w: 6, h: 4 },
    showLegend: true,
    animated: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleComponentSelect = (component: WidgetComponent) => {
    setSelectedComponent(component);
    setConfig({
      ...config,
      type: component.id,
      title: component.label,
      chartType: component.type === 'chart' ? 'bar' : undefined,
    });
  };

  const handleSave = async () => {
    if (!selectedComponent) {
      toast({
        title: 'Aucun composant sélectionné',
        description: 'Sélectionnez un type de widget à créer',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Générer le code React via Claude
      const { data, error } = await supabase.functions.invoke('generate-widget-from-visual', {
        body: {
          moduleId,
          config,
          componentType: selectedComponent.id,
        },
      });

      if (error) throw error;

      toast({
        title: 'Widget créé !',
        description: `"${config.title}" a été ajouté au module`,
      });

      if (onWidgetCreated && data.widget_id) {
        onWidgetCreated(data.widget_id);
      }

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la création du widget',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 bg-card/95 backdrop-blur-md border-[#03A5C0]/20">
        <div className="flex h-full">
          {/* Panel 1 : Components Library */}
          <div className="w-64 border-r border-border/50 bg-muted/20 flex flex-col">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-[#03A5C0]" />
                Composants
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez un type de widget
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {AVAILABLE_COMPONENTS.map((component) => {
                  const Icon = component.icon;
                  const isSelected = selectedComponent?.id === component.id;

                  return (
                    <motion.button
                      key={component.id}
                      onClick={() => handleComponentSelect(component)}
                      className={cn(
                        'w-full p-3 rounded-lg text-left transition-colors',
                        'hover:bg-muted flex items-start gap-3',
                        isSelected && 'bg-[#03A5C0]/10 border border-[#03A5C0]/50'
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          isSelected ? 'bg-[#03A5C0] text-white' : 'bg-muted'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{component.label}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {component.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Panel 2 : Canvas (Preview) */}
          <div className="flex-1 flex flex-col">
            <div className="h-14 border-b border-border/50 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#03A5C0]" />
                <span className="font-semibold text-sm">Aperçu</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!selectedComponent || isGenerating}
                  className="bg-[#03A5C0] hover:bg-[#03A5C0]/90"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Créer le Widget
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-auto">
              {selectedComponent ? (
                <WidgetPreview component={selectedComponent} config={config} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-[#03A5C0]/10 flex items-center justify-center mx-auto mb-4">
                      <Grid3x3 className="w-10 h-10 text-[#03A5C0]" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Créez votre widget</h3>
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez un composant dans la sidebar pour commencer
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel 3 : Properties */}
          {selectedComponent && (
            <div className="w-80 border-l border-border/50 bg-muted/20 flex flex-col">
              <div className="p-4 border-b border-border/50">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#03A5C0]" />
                  Propriétés
                </h3>
              </div>

              <ScrollArea className="flex-1 p-4">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">Général</TabsTrigger>
                    <TabsTrigger value="data">Données</TabsTrigger>
                    <TabsTrigger value="style">Style</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Titre du widget</Label>
                      <Input
                        value={config.title}
                        onChange={(e) => setConfig({ ...config, title: e.target.value })}
                        placeholder="Mon Widget"
                      />
                    </div>

                    {selectedComponent.type === 'chart' && (
                      <div className="space-y-2">
                        <Label>Type de graphique</Label>
                        <Select
                          value={config.chartType}
                          onValueChange={(value: any) =>
                            setConfig({ ...config, chartType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bar">Barres</SelectItem>
                            <SelectItem value="line">Ligne</SelectItem>
                            <SelectItem value="pie">Circulaire</SelectItem>
                            <SelectItem value="area">Aire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Largeur (colonnes / 12)</Label>
                      <Slider
                        value={[config.layout.w]}
                        onValueChange={(value) =>
                          setConfig({ ...config, layout: { ...config.layout, w: value[0] } })
                        }
                        min={3}
                        max={12}
                        step={1}
                      />
                      <p className="text-xs text-muted-foreground">{config.layout.w} / 12</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Hauteur (unités)</Label>
                      <Slider
                        value={[config.layout.h]}
                        onValueChange={(value) =>
                          setConfig({ ...config, layout: { ...config.layout, h: value[0] } })
                        }
                        min={2}
                        max={8}
                        step={1}
                      />
                      <p className="text-xs text-muted-foreground">{config.layout.h} unités</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="data" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Source de données</Label>
                      <Select
                        value={config.dataSource}
                        onValueChange={(value) => setConfig({ ...config, dataSource: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Données manuelles</SelectItem>
                          <SelectItem value="import">Données importées</SelectItem>
                          <SelectItem value="api">API externe</SelectItem>
                          <SelectItem value="database">Base de données</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <DatabaseIcon className="w-4 h-4" />
                        Les données peuvent être importées après la création du widget
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="style" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Couleur primaire</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={config.color}
                          onChange={(e) => setConfig({ ...config, color: e.target.value })}
                          className="w-20 h-10 p-1"
                        />
                        <Input
                          value={config.color}
                          onChange={(e) => setConfig({ ...config, color: e.target.value })}
                          placeholder="#03A5C0"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {selectedComponent.type === 'chart' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label>Afficher la légende</Label>
                          <Switch
                            checked={config.showLegend}
                            onCheckedChange={(checked) =>
                              setConfig({ ...config, showLegend: checked })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Animations</Label>
                          <Switch
                            checked={config.animated}
                            onCheckedChange={(checked) =>
                              setConfig({ ...config, animated: checked })
                            }
                          />
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Composant de preview du widget en construction
 */
function WidgetPreview({
  component,
  config,
}: {
  component: WidgetComponent;
  config: WidgetConfig;
}) {
  const Icon = component.icon;

  return (
    <motion.div
      key={component.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div
        className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-lg"
        style={{
          aspectRatio: `${config.layout.w} / ${config.layout.h}`,
          minHeight: `${config.layout.h * 80}px`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{config.title}</h3>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}15`, color: config.color }}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <div className="h-[calc(100%-60px)] flex items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-border/50">
          <div className="text-center">
            <Icon className="w-16 h-16 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Preview du {component.label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Le widget sera généré avec vos données
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-lg bg-[#03A5C0]/5 border border-[#03A5C0]/20">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#03A5C0]" />
          Claude générera automatiquement le code React pour ce widget
        </p>
      </div>
    </motion.div>
  );
}
