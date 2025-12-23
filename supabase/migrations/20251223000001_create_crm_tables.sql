-- =====================================================
-- MAGELLAN CRM/ERP SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Description: Tables pour le système CRM/ERP dynamique
-- Date: 2025-12-23
-- Author: Claude (Architecture Plan)
-- =====================================================

-- =====================================================
-- 1. EXTENSION DE build_sessions
-- =====================================================

-- Ajouter les colonnes pour le CRM
ALTER TABLE public.build_sessions
  ADD COLUMN IF NOT EXISTS business_sector TEXT,
  ADD COLUMN IF NOT EXISTS initial_modules_config JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN build_sessions.business_sector IS
  'Secteur d''activité détecté par l''IA: real_estate, ecommerce, restaurant, consulting, construction, health, education, legal, agency, saas, etc.';

COMMENT ON COLUMN build_sessions.initial_modules_config IS
  'Configuration initiale des modules CRM générés par l''IA lors de la création du projet';

-- =====================================================
-- 2. TABLE crm_modules
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES build_sessions(id) ON DELETE CASCADE NOT NULL,

  -- Identité du module
  name TEXT NOT NULL,
  -- Ex: "Gestion de Biens", "Produits", "Commandes", "Clients"

  module_type TEXT NOT NULL,
  -- Ex: "inventory", "sales", "clients", "analytics", "appointments", "contracts", "marketing", "finance"

  icon TEXT NOT NULL,
  -- Nom de l'icône Lucide React (ex: "Package", "ShoppingCart", "Users", "BarChart3")

  display_order INT NOT NULL DEFAULT 0,
  -- Ordre d'affichage dans la sidebar (plus petit = plus haut)

  -- Configuration JSON flexible
  config JSONB DEFAULT '{}'::jsonb,
  -- Ex: {
  --   "color": "#03A5C0",
  --   "description": "Gérez vos biens immobiliers",
  --   "permissions": ["view", "edit", "delete"]
  -- }

  is_active BOOLEAN DEFAULT true,
  -- Permet de désactiver un module sans le supprimer

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Contraintes
  CONSTRAINT valid_module_type CHECK (
    module_type IN (
      'inventory',      -- Gestion de stock/biens/produits
      'sales',          -- Ventes/commandes
      'clients',        -- Gestion clients/contacts
      'analytics',      -- Statistiques
      'appointments',   -- Rendez-vous/visites
      'contracts',      -- Contrats/mandats
      'marketing',      -- Marketing/campagnes
      'finance',        -- Finance/comptabilité
      'hr',             -- Ressources humaines
      'projects',       -- Gestion de projets
      'support',        -- Support client
      'custom'          -- Type personnalisé
    )
  )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_crm_modules_project ON crm_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_modules_order ON crm_modules(project_id, display_order);
CREATE INDEX IF NOT EXISTS idx_crm_modules_active ON crm_modules(project_id, is_active);

-- Row Level Security
ALTER TABLE crm_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own modules"
  ON crm_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own modules"
  ON crm_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own modules"
  ON crm_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own modules"
  ON crm_modules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. TABLE crm_widgets
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES crm_modules(id) ON DELETE CASCADE NOT NULL,

  -- Type de widget (depuis la registry)
  widget_type TEXT NOT NULL,
  -- Ex: "data-table", "kpi-card", "line-chart", "bar-chart", "pie-chart",
  --     "form", "calendar", "map", "kanban", "timeline"

  title TEXT NOT NULL,
  -- Ex: "Liste des biens", "CA du mois", "Graphique des ventes"

  -- Configuration spécifique au type de widget
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure varie selon widget_type
  -- Ex pour data-table:
  -- {
  --   "columns": [
  --     {"key": "address", "label": "Adresse", "type": "text"},
  --     {"key": "price", "label": "Prix", "type": "currency", "currency": "EUR"},
  --     {"key": "status", "label": "Statut", "type": "badge", "values": {"available": "Disponible", "sold": "Vendu"}}
  --   ],
  --   "filters": ["status", "price_range"],
  --   "sortable": true,
  --   "pagination": true,
  --   "actions": ["edit", "view", "delete"]
  -- }

  -- Layout dans le module (grid system 12 colonnes)
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ex: {"x": 0, "y": 0, "w": 6, "h": 4}
  -- x: position horizontale (0-11)
  -- y: position verticale (0+)
  -- w: largeur en colonnes (1-12)
  -- h: hauteur en unités (1+)

  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,

  -- Code généré par l'IA (optionnel, pour widgets complexes)
  generated_code TEXT,
  is_code_generated BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Contraintes
  CONSTRAINT valid_widget_type CHECK (
    widget_type IN (
      'data-table',     -- Tableau de données
      'kpi-card',       -- Carte KPI (métrique)
      'line-chart',     -- Graphique en ligne
      'bar-chart',      -- Graphique en barres
      'pie-chart',      -- Graphique circulaire
      'area-chart',     -- Graphique en aire
      'form',           -- Formulaire
      'calendar',       -- Calendrier
      'map',            -- Carte géographique
      'kanban',         -- Tableau Kanban
      'timeline',       -- Timeline
      'stats-grid',     -- Grille de statistiques
      'progress-bar',   -- Barre de progression
      'list',           -- Liste simple
      'gallery',        -- Galerie d'images
      'custom'          -- Widget personnalisé
    )
  )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_crm_widgets_module ON crm_widgets(module_id);
CREATE INDEX IF NOT EXISTS idx_crm_widgets_type ON crm_widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_crm_widgets_visible ON crm_widgets(module_id, is_visible);

-- Row Level Security
ALTER TABLE crm_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own widgets"
  ON crm_widgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own widgets"
  ON crm_widgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own widgets"
  ON crm_widgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own widgets"
  ON crm_widgets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. TABLE widget_data
-- =====================================================

CREATE TABLE IF NOT EXISTS public.widget_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES crm_widgets(id) ON DELETE CASCADE NOT NULL,

  -- Données du widget (structure flexible en JSON)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure varie selon le type de widget
  -- Ex pour data-table:
  -- {
  --   "rows": [
  --     {"id": "1", "address": "123 rue Paris", "price": 350000, "status": "available"},
  --     {"id": "2", "address": "456 av Lyon", "price": 450000, "status": "sold"}
  --   ]
  -- }
  -- Ex pour kpi-card:
  -- {
  --   "value": 24,
  --   "trend": "+12%",
  --   "period": "month",
  --   "previous_value": 21
  -- }
  -- Ex pour line-chart:
  -- {
  --   "series": [
  --     {"label": "Janvier", "value": 15000},
  --     {"label": "Février", "value": 18000},
  --     {"label": "Mars", "value": 22000}
  --   ]
  -- }

  -- Métadonnées supplémentaires
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Ex: {"last_import": "2025-01-15", "source": "manual", "version": 1}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_widget_data_widget ON widget_data(widget_id);
CREATE INDEX IF NOT EXISTS idx_widget_data_updated ON widget_data(updated_at DESC);

-- Row Level Security
ALTER TABLE widget_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own widget data"
  ON widget_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own widget data"
  ON widget_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own widget data"
  ON widget_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own widget data"
  ON widget_data FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. TRIGGERS pour updated_at
-- =====================================================

-- Trigger pour crm_modules
DROP TRIGGER IF EXISTS handle_crm_modules_updated_at ON crm_modules;
CREATE TRIGGER handle_crm_modules_updated_at
  BEFORE UPDATE ON public.crm_modules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger pour crm_widgets
DROP TRIGGER IF EXISTS handle_crm_widgets_updated_at ON crm_widgets;
CREATE TRIGGER handle_crm_widgets_updated_at
  BEFORE UPDATE ON public.crm_widgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger pour widget_data
DROP TRIGGER IF EXISTS handle_widget_data_updated_at ON widget_data;
CREATE TRIGGER handle_widget_data_updated_at
  BEFORE UPDATE ON public.widget_data
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 6. COMMENTAIRES pour documentation
-- =====================================================

COMMENT ON TABLE crm_modules IS
  'Modules CRM dynamiques générés par l''IA selon le secteur d''activité de l''utilisateur';

COMMENT ON TABLE crm_widgets IS
  'Widgets contenus dans les modules CRM. Chaque widget a un type (table, chart, form, etc.) et une configuration JSON';

COMMENT ON TABLE widget_data IS
  'Données des widgets CRM. Structure flexible en JSONB pour s''adapter à tous les types de widgets';

COMMENT ON COLUMN crm_modules.module_type IS
  'Type de module: inventory, sales, clients, analytics, appointments, contracts, marketing, finance, hr, projects, support, custom';

COMMENT ON COLUMN crm_widgets.widget_type IS
  'Type de widget: data-table, kpi-card, line-chart, bar-chart, pie-chart, form, calendar, map, kanban, timeline, custom';

COMMENT ON COLUMN crm_widgets.config IS
  'Configuration JSON du widget (colonnes pour table, axes pour chart, champs pour form, etc.)';

COMMENT ON COLUMN crm_widgets.layout IS
  'Position et taille du widget dans la grille 12 colonnes: {x, y, w, h}';

COMMENT ON COLUMN widget_data.data IS
  'Données du widget en JSON (rows pour table, value pour KPI, series pour chart, etc.)';
