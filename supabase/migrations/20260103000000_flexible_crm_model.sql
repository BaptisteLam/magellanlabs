-- Migration: Modèle de données flexible pour CRM bac à sable (inspiré Attio)
-- Description: Remplace le modèle rigide par un modèle JSONB flexible
-- Phase 1 du plan de refonte CRM

-- ============================================================================
-- TABLE: object_definitions
-- Définit les types d'objets dynamiques (équivalent des "tables" personnalisées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  singular_label VARCHAR(100) NOT NULL,
  plural_label VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'box',
  color VARCHAR(20) DEFAULT '#03A5C0',
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  view_config JSONB DEFAULT '{"default":"table","available":["table","kanban","timeline"]}',
  settings JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  generated_by_ai BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Index pour performance
CREATE INDEX idx_object_definitions_project ON object_definitions(project_id);
CREATE INDEX idx_object_definitions_name ON object_definitions(project_id, name);

-- ============================================================================
-- TABLE: custom_objects
-- Stocke les records (instances) des objets avec données flexibles en JSONB
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  object_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (project_id, object_type) REFERENCES object_definitions(project_id, name) ON DELETE CASCADE
);

-- Index GIN pour recherche performante dans JSONB
CREATE INDEX idx_custom_objects_data ON custom_objects USING GIN (data);
CREATE INDEX idx_custom_objects_project_type ON custom_objects(project_id, object_type);
CREATE INDEX idx_custom_objects_created_at ON custom_objects(created_at DESC);

-- ============================================================================
-- TABLE: object_relations
-- Gère les relations entre objets (graph model)
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  source_type VARCHAR(100) NOT NULL,
  source_id UUID NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
  target_type VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
  relation_type VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

-- Index pour performance des requêtes de relations
CREATE INDEX idx_relations_source ON object_relations(source_type, source_id);
CREATE INDEX idx_relations_target ON object_relations(target_type, target_id);
CREATE INDEX idx_relations_project ON object_relations(project_id);

-- ============================================================================
-- TABLE: object_views
-- Stocke les vues personnalisées (filtres, colonnes, tri)
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  object_type VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  view_type VARCHAR(50) NOT NULL DEFAULT 'table', -- 'table', 'kanban', 'timeline', 'calendar'
  filters JSONB DEFAULT '[]',
  sort_config JSONB DEFAULT '{}',
  visible_fields JSONB DEFAULT '[]',
  layout_config JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (project_id, object_type) REFERENCES object_definitions(project_id, name) ON DELETE CASCADE
);

-- Index pour performance
CREATE INDEX idx_object_views_project_type ON object_views(project_id, object_type);
CREATE INDEX idx_object_views_default ON object_views(project_id, object_type, is_default) WHERE is_default = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Isolation des données par projet et utilisateur
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE object_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_views ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir les objets de leurs projets
CREATE POLICY "Users can view their project object definitions"
  ON object_definitions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create object definitions in their projects"
  ON object_definitions FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their project object definitions"
  ON object_definitions FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project object definitions"
  ON object_definitions FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Politique: Les utilisateurs peuvent gérer les records de leurs projets
CREATE POLICY "Users can view their project custom objects"
  ON custom_objects FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create custom objects in their projects"
  ON custom_objects FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their project custom objects"
  ON custom_objects FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project custom objects"
  ON custom_objects FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Politique: Relations
CREATE POLICY "Users can view their project relations"
  ON object_relations FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their project relations"
  ON object_relations FOR ALL
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Politique: Vues
CREATE POLICY "Users can view their project views"
  ON object_views FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their project views"
  ON object_views FOR ALL
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS pour updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_object_definitions_updated_at
  BEFORE UPDATE ON object_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_objects_updated_at
  BEFORE UPDATE ON custom_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_object_views_updated_at
  BEFORE UPDATE ON object_views
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTAIRES pour documentation
-- ============================================================================

COMMENT ON TABLE object_definitions IS 'Définitions d''objets dynamiques (types de données personnalisables)';
COMMENT ON TABLE custom_objects IS 'Records (instances) des objets avec données flexibles en JSONB';
COMMENT ON TABLE object_relations IS 'Relations entre objets (graph model avec backlinks)';
COMMENT ON TABLE object_views IS 'Vues personnalisées (filtres, tri, colonnes visibles)';

COMMENT ON COLUMN object_definitions.fields IS 'Array JSONB de définitions de champs avec type, label, config, etc.';
COMMENT ON COLUMN custom_objects.data IS 'Données du record en JSONB (structure définie par object_definitions.fields)';
COMMENT ON COLUMN object_relations.relation_type IS 'Type de relation (ex: "contact_to_company", "deal_to_contact")';
COMMENT ON COLUMN object_views.filters IS 'Array JSONB de conditions de filtre';
COMMENT ON COLUMN object_views.layout_config IS 'Configuration spécifique au type de vue (ex: colonnes kanban, groupBy, etc.)';
