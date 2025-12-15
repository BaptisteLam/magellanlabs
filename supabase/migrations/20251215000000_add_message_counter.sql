-- Ajouter la colonne de comptage de messages aux profils utilisateurs
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;

-- Supprimer les anciennes colonnes de tokens (optionnel - décommenter si vous voulez les supprimer)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS tokens_used;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS tokens_quota;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_messages_used ON public.profiles(messages_used);
