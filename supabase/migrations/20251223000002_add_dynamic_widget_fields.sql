-- Migration: Ajouter les champs pour les widgets dynamiques générés par code
-- Description: Ajoute les champs nécessaires pour supporter la génération de code React dynamique

-- Ajouter les nouveaux champs à la table crm_widgets
ALTER TABLE public.crm_widgets
  ADD COLUMN IF NOT EXISTS generation_prompt TEXT,
  ADD COLUMN IF NOT EXISTS generation_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS code_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}'::jsonb;

-- Ajouter un commentaire pour documentation
COMMENT ON COLUMN public.crm_widgets.generation_prompt IS 'Prompt original de l''utilisateur qui a généré ce widget';
COMMENT ON COLUMN public.crm_widgets.generation_timestamp IS 'Timestamp de la dernière génération/régénération du code';
COMMENT ON COLUMN public.crm_widgets.code_version IS 'Version du code, incrémenté à chaque régénération';
COMMENT ON COLUMN public.crm_widgets.data_sources IS 'Sources de données accessibles au widget : {"site_forms": [], "crm_widgets": [], "external_apis": []}';

-- Index pour optimiser les requêtes par version
CREATE INDEX IF NOT EXISTS idx_crm_widgets_code_version ON public.crm_widgets(code_version);

-- Index pour rechercher par prompt (full-text search)
CREATE INDEX IF NOT EXISTS idx_crm_widgets_generation_prompt ON public.crm_widgets USING gin(to_tsvector('french', generation_prompt));
