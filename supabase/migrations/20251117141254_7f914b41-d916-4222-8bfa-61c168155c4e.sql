-- Étape 1: Supprimer l'ancienne contrainte CHECK
ALTER TABLE public.build_sessions 
  DROP CONSTRAINT IF EXISTS build_sessions_project_type_check;

-- Étape 2: Mettre à jour les valeurs existantes pour correspondre aux nouvelles valeurs
UPDATE public.build_sessions 
SET project_type = CASE 
  WHEN project_type IN ('html', 'vue') THEN 'website'
  WHEN project_type IN ('react', 'nextjs') THEN 'webapp'
  ELSE project_type 
END
WHERE project_type IN ('html', 'react', 'vue', 'nextjs');

-- Étape 3: Modifier la colonne pour changer le défaut et ajouter la nouvelle contrainte
ALTER TABLE public.build_sessions 
  ALTER COLUMN project_type SET DEFAULT 'website',
  ADD CONSTRAINT build_sessions_project_type_check 
    CHECK (project_type IN ('website', 'webapp', 'mobile'));

COMMENT ON COLUMN public.build_sessions.project_type IS 'Type of project: website (HTML/CSS/JS), webapp (React), or mobile (React Native)';
