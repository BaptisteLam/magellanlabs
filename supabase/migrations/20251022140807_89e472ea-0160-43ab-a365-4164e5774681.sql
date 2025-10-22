-- Table pour les profils utilisateurs
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour les profils
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Table pour les sites web générés
CREATE TABLE public.websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  cloudflare_url TEXT,
  cloudflare_project_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les sites
CREATE POLICY "Users can view own websites"
  ON public.websites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own websites"
  ON public.websites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own websites"
  ON public.websites
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own websites"
  ON public.websites
  FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour créer automatiquement le profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger pour créer le profil à l'inscription
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers pour updated_at
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_websites_updated_at
  BEFORE UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();