-- Supprimer l'ancienne contrainte et ajouter la nouvelle avec tous les types frontend
ALTER TABLE crm_widgets DROP CONSTRAINT IF EXISTS valid_widget_type;

ALTER TABLE crm_widgets ADD CONSTRAINT valid_widget_type CHECK (
  widget_type = ANY (ARRAY[
    'kpi-card', 'data-table', 'line-chart', 'bar-chart', 'pie-chart', 
    'area-chart', 'form', 'calendar', 'map', 'kanban', 'timeline', 
    'stats-grid', 'progress-bar', 'list', 'gallery', 'custom', 'dynamic'
  ])
);