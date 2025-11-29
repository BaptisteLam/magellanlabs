-- Activer le realtime sur la table profiles pour permettre la mise à jour en temps réel du compteur de tokens
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;