/**
 * ViewBuilder - Constructeur de vues personnalisées
 * Configure les vues disponibles pour un objet CRM
 */

import { ViewType } from '@/types/crm-objects';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, LayoutGrid, Calendar as CalendarIcon, Clock } from 'lucide-react';

interface ViewConfig {
  default: ViewType;
  available: ViewType[];
}

interface ViewBuilderProps {
  viewConfig: ViewConfig;
  onChange: (config: ViewConfig) => void;
}

const VIEWS = [
  { value: 'table' as ViewType, label: 'Table', description: 'Vue tabulaire avec colonnes et filtres', icon: Table },
  { value: 'kanban' as ViewType, label: 'Kanban', description: 'Colonnes par statut avec drag & drop', icon: LayoutGrid },
  { value: 'timeline' as ViewType, label: 'Timeline', description: 'Chronologie avec dates de début/fin', icon: Clock },
  { value: 'calendar' as ViewType, label: 'Calendrier', description: 'Vue mensuelle pour les événements', icon: CalendarIcon },
];

export function ViewBuilder({ viewConfig, onChange }: ViewBuilderProps) {
  const handleToggleView = (view: ViewType, checked: boolean) => {
    if (checked) {
      onChange({
        ...viewConfig,
        available: [...viewConfig.available, view],
      });
    } else {
      // Ne pas désactiver la vue par défaut
      if (view === viewConfig.default) {
        alert('Vous ne pouvez pas désactiver la vue par défaut. Changez d\'abord la vue par défaut.');
        return;
      }

      onChange({
        ...viewConfig,
        available: viewConfig.available.filter((v) => v !== view),
      });
    }
  };

  const handleSetDefault = (view: ViewType) => {
    // S'assurer que la vue par défaut est dans les vues disponibles
    if (!viewConfig.available.includes(view)) {
      onChange({
        default: view,
        available: [...viewConfig.available, view],
      });
    } else {
      onChange({
        ...viewConfig,
        default: view,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Vue par défaut */}
      <Card>
        <CardHeader>
          <CardTitle>Vue par défaut</CardTitle>
          <CardDescription>
            La vue qui s'affiche en premier lors de l'ouverture de cet objet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={viewConfig.default} onValueChange={handleSetDefault}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map((view) => {
                const Icon = view.icon;
                return (
                  <SelectItem key={view.value} value={view.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{view.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Vues disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Vues disponibles</CardTitle>
          <CardDescription>
            Sélectionnez les vues que les utilisateurs pourront utiliser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {VIEWS.map((view) => {
              const Icon = view.icon;
              const isChecked = viewConfig.available.includes(view.value);
              const isDefault = viewConfig.default === view.value;

              return (
                <div
                  key={view.value}
                  className="flex items-start gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                >
                  <Checkbox
                    id={`view-${view.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggleView(view.value, checked as boolean)}
                    className="mt-1"
                  />
                  <label
                    htmlFor={`view-${view.value}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-white">{view.label}</span>
                      {isDefault && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                          Par défaut
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{view.description}</p>
                  </label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vue Recommandations */}
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <CardHeader>
          <CardTitle className="text-sm text-cyan-400">💡 Recommandations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-300 space-y-2">
          <p>
            <strong>Table</strong> : Idéale pour tous les objets, offre une vue d'ensemble complète
          </p>
          <p>
            <strong>Kanban</strong> : Nécessite un champ de type "status". Parfait pour les pipelines de vente, gestion de tâches
          </p>
          <p>
            <strong>Timeline</strong> : Nécessite au moins un champ "date" ou "datetime". Idéal pour les projets avec échéances
          </p>
          <p>
            <strong>Calendrier</strong> : Nécessite un champ "date" ou "datetime". Parfait pour les rendez-vous, événements
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
