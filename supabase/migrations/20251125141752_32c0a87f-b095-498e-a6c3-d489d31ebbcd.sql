-- Ajouter les colonnes de comptage de tokens aux profils utilisateurs
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tokens_used BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_quota BIGINT DEFAULT 1000000;