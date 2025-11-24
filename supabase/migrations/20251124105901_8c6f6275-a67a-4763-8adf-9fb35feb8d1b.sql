-- Ajouter les colonnes pour stocker les informations GitHub
ALTER TABLE build_sessions 
ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
ADD COLUMN IF NOT EXISTS github_repo_url TEXT;