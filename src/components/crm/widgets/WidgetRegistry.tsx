/**
 * Widget Registry - Système de rendu dynamique des widgets CRM
 * Chaque widget est un composant React réutilisable avec config JSON
 */

import React from 'react';

export type WidgetType =
  | 'data-table'
  | 'kpi-card'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'area-chart'
  | 'form'
  | 'calendar'
  | 'map'
  | 'kanban'
  | 'timeline'
  | 'stats-grid'
  | 'progress-bar'
  | 'list'
  | 'gallery'
  | 'custom';

export interface WidgetProps {
  widgetId: string;
  title: string;
  config: any;
  data?: any;
  onUpdate?: (newData: any) => void;
  onConfigUpdate?: (newConfig: any) => void;
}

// Import des widgets (lazy loading pour performance)
const DataTable = React.lazy(() => import('./DataTable'));
const KPICard = React.lazy(() => import('./KPICard'));
const LineChart = React.lazy(() => import('./LineChart'));
const BarChart = React.lazy(() => import('./BarChart'));
const PieChart = React.lazy(() => import('./PieChart'));
const FormWidget = React.lazy(() => import('./FormWidget'));
const CalendarWidget = React.lazy(() => import('./CalendarWidget'));
const ListWidget = React.lazy(() => import('./ListWidget'));
const StatsGrid = React.lazy(() => import('./StatsGrid'));

/**
 * Registry principal des widgets
 * Mapping widget_type → Composant React
 */
export const WIDGET_REGISTRY: Record<WidgetType, React.LazyExoticComponent<React.ComponentType<WidgetProps>>> = {
  'data-table': DataTable,
  'kpi-card': KPICard,
  'line-chart': LineChart,
  'bar-chart': BarChart,
  'pie-chart': PieChart,
  'area-chart': LineChart, // Même composant, config différente
  'form': FormWidget,
  'calendar': CalendarWidget,
  'list': ListWidget,
  'stats-grid': StatsGrid,

  // Widgets non encore implémentés (placeholder)
  'map': ListWidget, // TODO: Implémenter MapWidget
  'kanban': ListWidget, // TODO: Implémenter KanbanWidget
  'timeline': ListWidget, // TODO: Implémenter TimelineWidget
  'progress-bar': KPICard, // Similaire à KPI
  'gallery': ListWidget, // TODO: Implémenter GalleryWidget
  'custom': ListWidget, // Fallback
};

/**
 * Métadonnées des widgets (pour UI de sélection)
 */
export const WIDGET_METADATA: Record<WidgetType, {
  label: string;
  description: string;
  icon: string;
  category: 'data' | 'chart' | 'input' | 'display';
}> = {
  'data-table': {
    label: 'Tableau de Données',
    description: 'Tableau avec colonnes, tri et filtres',
    icon: 'Table',
    category: 'data'
  },
  'kpi-card': {
    label: 'Carte KPI',
    description: 'Métrique avec icône et tendance',
    icon: 'BarChart3',
    category: 'data'
  },
  'line-chart': {
    label: 'Graphique en Ligne',
    description: 'Évolution dans le temps',
    icon: 'LineChart',
    category: 'chart'
  },
  'bar-chart': {
    label: 'Graphique en Barres',
    description: 'Comparaison de valeurs',
    icon: 'BarChart',
    category: 'chart'
  },
  'pie-chart': {
    label: 'Graphique Circulaire',
    description: 'Répartition en pourcentage',
    icon: 'PieChart',
    category: 'chart'
  },
  'area-chart': {
    label: 'Graphique en Aire',
    description: 'Évolution avec surface remplie',
    icon: 'AreaChart',
    category: 'chart'
  },
  'form': {
    label: 'Formulaire',
    description: 'Formulaire de saisie de données',
    icon: 'FileText',
    category: 'input'
  },
  'calendar': {
    label: 'Calendrier',
    description: 'Planification et événements',
    icon: 'Calendar',
    category: 'display'
  },
  'map': {
    label: 'Carte Géographique',
    description: 'Visualisation sur carte',
    icon: 'Map',
    category: 'display'
  },
  'kanban': {
    label: 'Tableau Kanban',
    description: 'Gestion de tâches par colonne',
    icon: 'Kanban',
    category: 'display'
  },
  'timeline': {
    label: 'Timeline',
    description: 'Chronologie d\'événements',
    icon: 'Clock',
    category: 'display'
  },
  'stats-grid': {
    label: 'Grille de Stats',
    description: 'Plusieurs KPIs en grille',
    icon: 'Grid3x3',
    category: 'data'
  },
  'progress-bar': {
    label: 'Barre de Progression',
    description: 'Indicateur de progression',
    icon: 'Loader',
    category: 'display'
  },
  'list': {
    label: 'Liste',
    description: 'Liste simple d\'éléments',
    icon: 'List',
    category: 'display'
  },
  'gallery': {
    label: 'Galerie',
    description: 'Galerie d\'images',
    icon: 'Image',
    category: 'display'
  },
  'custom': {
    label: 'Widget Personnalisé',
    description: 'Widget généré par code',
    icon: 'Code',
    category: 'display'
  }
};

/**
 * Vérifie si un type de widget existe
 */
export function isValidWidgetType(type: string): type is WidgetType {
  return type in WIDGET_REGISTRY;
}

/**
 * Récupère le composant pour un type de widget
 */
export function getWidgetComponent(type: WidgetType) {
  return WIDGET_REGISTRY[type];
}

/**
 * Récupère les métadonnées d'un widget
 */
export function getWidgetMetadata(type: WidgetType) {
  return WIDGET_METADATA[type];
}
