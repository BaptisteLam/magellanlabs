-- Migration pour corriger le problème de création de profils utilisateurs
-- Le trigger on_auth_user_created devrait créer les profils automatiquement,
-- mais cette migration ajoute une politique de sécurité pour permettre la création
-- programmatique de profils en fallback.

-- Ajouter une politique INSERT pour permettre aux utilisateurs de créer leur propre profil
-- (seulement si l'ID correspond à leur auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- S'assurer que le trigger existe et fonctionne correctement
-- Recréer la fonction si nécessaire
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- S'assurer que le trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
