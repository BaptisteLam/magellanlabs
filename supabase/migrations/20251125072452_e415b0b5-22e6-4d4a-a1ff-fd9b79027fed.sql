-- Ajouter un champ pour stocker l'URL publique du projet
ALTER TABLE build_sessions 
ADD COLUMN public_url TEXT;

-- Créer une table pour les projets publics
CREATE TABLE IF NOT EXISTS public.published_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_session_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  subdomain TEXT NOT NULL UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  view_count INTEGER DEFAULT 0,
  CONSTRAINT valid_subdomain CHECK (subdomain ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Enable RLS
ALTER TABLE public.published_projects ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre à tout le monde de voir les projets publiés
CREATE POLICY "Anyone can view published projects"
ON public.published_projects
FOR SELECT
USING (true);

-- Policy pour permettre aux propriétaires de créer/modifier leurs projets publiés
CREATE POLICY "Users can manage their own published projects"
ON public.published_projects
FOR ALL
USING (
  build_session_id IN (
    SELECT id FROM build_sessions WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  build_session_id IN (
    SELECT id FROM build_sessions WHERE user_id = auth.uid()
  )
);

-- Index pour recherche rapide par subdomain
CREATE INDEX idx_published_projects_subdomain ON public.published_projects(subdomain);

-- Index pour recherche par build_session_id
CREATE INDEX idx_published_projects_session ON public.published_projects(build_session_id);

-- Fonction pour incrémenter le compteur de vues
CREATE OR REPLACE FUNCTION increment_view_count(project_subdomain TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE published_projects
  SET view_count = view_count + 1
  WHERE subdomain = project_subdomain;
END;
$$;