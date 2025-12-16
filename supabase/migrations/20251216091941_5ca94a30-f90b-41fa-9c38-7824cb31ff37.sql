-- Ajouter la colonne messages_used pour compter les messages utilisateur
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;