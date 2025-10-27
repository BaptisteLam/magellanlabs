-- Mettre à jour la structure pour stocker les fichiers au format JSON structuré
ALTER TABLE public.build_sessions 
  DROP COLUMN IF EXISTS html_content,
  ADD COLUMN IF NOT EXISTS project_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'html' CHECK (project_type IN ('html', 'react', 'vue', 'nextjs'));

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_build_sessions_project_files ON public.build_sessions USING GIN (project_files);

COMMENT ON COLUMN public.build_sessions.project_files IS 'Array of file objects with structure: [{path: string, content: string, type: string}]';
COMMENT ON COLUMN public.build_sessions.project_type IS 'Type of project: html, react, vue, or nextjs';