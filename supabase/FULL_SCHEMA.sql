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
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();-- Correction du search_path pour la fonction handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create build_sessions table to store unique generation sessions
CREATE TABLE IF NOT EXISTS public.build_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  html_content TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.build_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own sessions and allow anonymous users to view sessions they created
CREATE POLICY "Users can view their own sessions or anonymous sessions"
ON public.build_sessions
FOR SELECT
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Allow users to insert their own sessions
CREATE POLICY "Users can create sessions"
ON public.build_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);

-- Allow users to update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.build_sessions
FOR UPDATE
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Allow users to delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON public.build_sessions
FOR DELETE
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_build_sessions_updated_at
BEFORE UPDATE ON public.build_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  html text,
  css text,
  js text,
  prompt text,
  ai_response text,
  project_url text UNIQUE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON public.projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_project_url ON public.projects(project_url);-- Delete all anonymous sessions (user_id IS NULL) to prepare for constraint
DELETE FROM public.build_sessions WHERE user_id IS NULL;

-- Drop old policies that allow NULL user_id
DROP POLICY IF EXISTS "Users can create sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions or anonymous sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.build_sessions;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can create their own sessions"
ON public.build_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their own sessions"
ON public.build_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own sessions"
ON public.build_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own sessions"
ON public.build_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Make user_id NOT NULL to enforce authentication
ALTER TABLE public.build_sessions 
ALTER COLUMN user_id SET NOT NULL;-- Mettre à jour la structure pour stocker les fichiers au format JSON structuré
ALTER TABLE public.build_sessions 
  DROP COLUMN IF EXISTS html_content,
  ADD COLUMN IF NOT EXISTS project_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'html' CHECK (project_type IN ('html', 'react', 'vue', 'nextjs'));

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_build_sessions_project_files ON public.build_sessions USING GIN (project_files);

COMMENT ON COLUMN public.build_sessions.project_files IS 'Array of file objects with structure: [{path: string, content: string, type: string}]';
COMMENT ON COLUMN public.build_sessions.project_type IS 'Type of project: html, react, vue, or nextjs';-- Add thumbnail_url column to build_sessions table
ALTER TABLE public.build_sessions
ADD COLUMN thumbnail_url text;

-- Add thumbnail_url column to websites table  
ALTER TABLE public.websites
ADD COLUMN thumbnail_url text;-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true);

-- Create RLS policies for screenshots bucket
CREATE POLICY "Screenshots are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');-- Add cloudflare_project_name column to build_sessions table
ALTER TABLE public.build_sessions 
ADD COLUMN cloudflare_project_name TEXT,
ADD COLUMN cloudflare_deployment_url TEXT;-- Add Netlify deployment fields to build_sessions table
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS netlify_site_id TEXT,
ADD COLUMN IF NOT EXISTS netlify_deployment_url TEXT;

-- Add Netlify deployment fields to websites table
ALTER TABLE public.websites 
ADD COLUMN IF NOT EXISTS netlify_site_id TEXT,
ADD COLUMN IF NOT EXISTS netlify_url TEXT;-- Add Google Analytics columns to websites table
ALTER TABLE public.websites
ADD COLUMN IF NOT EXISTS ga_property_id TEXT,
ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT;-- Add website_id column to build_sessions to link sessions to published websites
ALTER TABLE public.build_sessions
ADD COLUMN IF NOT EXISTS website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL;-- Table pour stocker les messages de chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour recherche rapide par session
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own chat messages"
  ON public.chat_messages
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
    )
  );-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add status and build_session_id columns to websites table
ALTER TABLE public.websites
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS build_session_id UUID REFERENCES public.build_sessions(id);-- Étape 1: Supprimer l'ancienne contrainte CHECK
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
-- Ajouter les colonnes pour stocker les informations GitHub
ALTER TABLE build_sessions 
ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
ADD COLUMN IF NOT EXISTS github_repo_url TEXT;-- Ajouter un champ pour stocker l'URL publique du projet
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
$$;-- Ajouter les colonnes de comptage de tokens aux profils utilisateurs
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tokens_used BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_quota BIGINT DEFAULT 1000000;-- Activer le realtime sur la table profiles pour permettre la mise à jour en temps réel du compteur de tokens
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;-- Add web_analytics_site_token column to build_sessions for Cloudflare Web Analytics
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS web_analytics_site_token TEXT;-- Create project_memory table for persistent context
CREATE TABLE IF NOT EXISTS public.project_memory (
  session_id UUID PRIMARY KEY REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  architecture JSONB DEFAULT '{}'::jsonb,
  recent_changes JSONB[] DEFAULT ARRAY[]::jsonb[],
  known_issues JSONB[] DEFAULT ARRAY[]::jsonb[],
  user_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_memory ON public.project_memory(session_id);

-- Create index on updated_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_memory_updated ON public.project_memory(updated_at DESC);

-- Enable RLS
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;

-- Users can view their own project memory
CREATE POLICY "Users can view own project memory"
ON public.project_memory
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Users can insert their own project memory
CREATE POLICY "Users can insert own project memory"
ON public.project_memory
FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Users can update their own project memory
CREATE POLICY "Users can update own project memory"
ON public.project_memory
FOR UPDATE
USING (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Users can delete their own project memory
CREATE POLICY "Users can delete own project memory"
ON public.project_memory
FOR DELETE
USING (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_project_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_memory_timestamp
BEFORE UPDATE ON public.project_memory
FOR EACH ROW
EXECUTE FUNCTION update_project_memory_updated_at();-- Fix search_path security warning for update_project_memory_updated_at function
CREATE OR REPLACE FUNCTION public.update_project_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER;-- Table pour les contacts reçus par projet
CREATE TABLE public.project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les articles de blog par projet
CREATE TABLE public.project_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  featured_image TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les factures par projet
CREATE TABLE public.project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending',
  line_items JSONB DEFAULT '[]',
  client_info JSONB DEFAULT '{}',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les métadonnées SEO par page
CREATE TABLE public.project_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  keywords JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, page_path)
);

-- Table pour les domaines personnalisés
CREATE TABLE public.project_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  dns_records JSONB DEFAULT '[]',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour la configuration marketing
CREATE TABLE public.project_marketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  social_links JSONB DEFAULT '{}',
  email_settings JSONB DEFAULT '{}',
  campaigns JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Table pour les données financières
CREATE TABLE public.project_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  payment_methods JSONB DEFAULT '[]',
  revenue_stats JSONB DEFAULT '{}',
  expense_tracking JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS on all tables
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_finance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_contacts
CREATE POLICY "Users can view contacts of their projects" ON public.project_contacts
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert contacts to their projects" ON public.project_contacts
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update contacts of their projects" ON public.project_contacts
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete contacts of their projects" ON public.project_contacts
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_blog_posts
CREATE POLICY "Users can view blog posts of their projects" ON public.project_blog_posts
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert blog posts to their projects" ON public.project_blog_posts
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update blog posts of their projects" ON public.project_blog_posts
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete blog posts of their projects" ON public.project_blog_posts
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_invoices
CREATE POLICY "Users can view invoices of their projects" ON public.project_invoices
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert invoices to their projects" ON public.project_invoices
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update invoices of their projects" ON public.project_invoices
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete invoices of their projects" ON public.project_invoices
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_seo
CREATE POLICY "Users can view SEO of their projects" ON public.project_seo
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert SEO to their projects" ON public.project_seo
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update SEO of their projects" ON public.project_seo
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete SEO of their projects" ON public.project_seo
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_domains
CREATE POLICY "Users can view domains of their projects" ON public.project_domains
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert domains to their projects" ON public.project_domains
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update domains of their projects" ON public.project_domains
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete domains of their projects" ON public.project_domains
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_marketing
CREATE POLICY "Users can view marketing of their projects" ON public.project_marketing
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert marketing to their projects" ON public.project_marketing
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update marketing of their projects" ON public.project_marketing
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete marketing of their projects" ON public.project_marketing
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_finance
CREATE POLICY "Users can view finance of their projects" ON public.project_finance
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert finance to their projects" ON public.project_finance
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update finance of their projects" ON public.project_finance
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete finance of their projects" ON public.project_finance
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_project_blog_posts_updated_at
BEFORE UPDATE ON public.project_blog_posts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_seo_updated_at
BEFORE UPDATE ON public.project_seo
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_marketing_updated_at
BEFORE UPDATE ON public.project_marketing
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_finance_updated_at
BEFORE UPDATE ON public.project_finance
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();-- Ajouter une policy pour permettre l'insertion publique anonyme sur project_contacts
-- Cela permet aux visiteurs des sites générés d'envoyer des messages de contact

CREATE POLICY "Anyone can insert contacts"
ON public.project_contacts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
-- Add project_icon column to build_sessions
ALTER TABLE public.build_sessions 
ADD COLUMN project_icon text DEFAULT NULL;

-- Create storage bucket for project icons if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-icons', 'project-icons', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for project icons bucket - anyone can view
CREATE POLICY "Project icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-icons');

-- Users can upload their own project icons
CREATE POLICY "Users can upload project icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-icons' 
  AND auth.uid() IS NOT NULL
);

-- Users can update their own project icons
CREATE POLICY "Users can update project icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-icons' 
  AND auth.uid() IS NOT NULL
);

-- Users can delete their own project icons
CREATE POLICY "Users can delete project icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-icons' 
  AND auth.uid() IS NOT NULL
);-- Create custom_domains table for Domain Connect
CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES build_sessions(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  cloudflare_project_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dns_verified BOOLEAN DEFAULT false,
  method TEXT NOT NULL,
  provider_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'failed')),
  CONSTRAINT valid_method CHECK (method IN ('automatic', 'manual'))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_domains_user ON custom_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_session ON custom_domains(session_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

-- Enable Row Level Security
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own domains"
  ON custom_domains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own domains"
  ON custom_domains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domains"
  ON custom_domains FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own domains"
  ON custom_domains FOR DELETE
  USING (auth.uid() = user_id);
-- Ajouter la colonne de comptage de messages aux profils utilisateurs
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;

-- Supprimer les anciennes colonnes de tokens (optionnel - décommenter si vous voulez les supprimer)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS tokens_used;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS tokens_quota;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_messages_used ON public.profiles(messages_used);
-- Ajouter la colonne messages_used pour compter les messages utilisateur
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;-- =====================================================
-- MAGELLAN CRM/ERP SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Description: Tables pour le système CRM/ERP dynamique
-- Date: 2025-12-23
-- Author: Claude (Architecture Plan)
-- =====================================================

-- =====================================================
-- 1. EXTENSION DE build_sessions
-- =====================================================

-- Ajouter les colonnes pour le CRM
ALTER TABLE public.build_sessions
  ADD COLUMN IF NOT EXISTS business_sector TEXT,
  ADD COLUMN IF NOT EXISTS initial_modules_config JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN build_sessions.business_sector IS
  'Secteur d''activité détecté par l''IA: real_estate, ecommerce, restaurant, consulting, construction, health, education, legal, agency, saas, etc.';

COMMENT ON COLUMN build_sessions.initial_modules_config IS
  'Configuration initiale des modules CRM générés par l''IA lors de la création du projet';

-- =====================================================
-- 2. TABLE crm_modules
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES build_sessions(id) ON DELETE CASCADE NOT NULL,

  -- Identité du module
  name TEXT NOT NULL,
  -- Ex: "Gestion de Biens", "Produits", "Commandes", "Clients"

  module_type TEXT NOT NULL,
  -- Ex: "inventory", "sales", "clients", "analytics", "appointments", "contracts", "marketing", "finance"

  icon TEXT NOT NULL,
  -- Nom de l'icône Lucide React (ex: "Package", "ShoppingCart", "Users", "BarChart3")

  display_order INT NOT NULL DEFAULT 0,
  -- Ordre d'affichage dans la sidebar (plus petit = plus haut)

  -- Configuration JSON flexible
  config JSONB DEFAULT '{}'::jsonb,
  -- Ex: {
  --   "color": "#03A5C0",
  --   "description": "Gérez vos biens immobiliers",
  --   "permissions": ["view", "edit", "delete"]
  -- }

  is_active BOOLEAN DEFAULT true,
  -- Permet de désactiver un module sans le supprimer

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Contraintes
  CONSTRAINT valid_module_type CHECK (
    module_type IN (
      'inventory',      -- Gestion de stock/biens/produits
      'sales',          -- Ventes/commandes
      'clients',        -- Gestion clients/contacts
      'analytics',      -- Statistiques
      'appointments',   -- Rendez-vous/visites
      'contracts',      -- Contrats/mandats
      'marketing',      -- Marketing/campagnes
      'finance',        -- Finance/comptabilité
      'hr',             -- Ressources humaines
      'projects',       -- Gestion de projets
      'support',        -- Support client
      'custom'          -- Type personnalisé
    )
  )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_crm_modules_project ON crm_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_modules_order ON crm_modules(project_id, display_order);
CREATE INDEX IF NOT EXISTS idx_crm_modules_active ON crm_modules(project_id, is_active);

-- Row Level Security
ALTER TABLE crm_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own modules"
  ON crm_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own modules"
  ON crm_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own modules"
  ON crm_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own modules"
  ON crm_modules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM build_sessions
      WHERE build_sessions.id = crm_modules.project_id
      AND build_sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. TABLE crm_widgets
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES crm_modules(id) ON DELETE CASCADE NOT NULL,

  -- Type de widget (depuis la registry)
  widget_type TEXT NOT NULL,
  -- Ex: "data-table", "kpi-card", "line-chart", "bar-chart", "pie-chart",
  --     "form", "calendar", "map", "kanban", "timeline"

  title TEXT NOT NULL,
  -- Ex: "Liste des biens", "CA du mois", "Graphique des ventes"

  -- Configuration spécifique au type de widget
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure varie selon widget_type
  -- Ex pour data-table:
  -- {
  --   "columns": [
  --     {"key": "address", "label": "Adresse", "type": "text"},
  --     {"key": "price", "label": "Prix", "type": "currency", "currency": "EUR"},
  --     {"key": "status", "label": "Statut", "type": "badge", "values": {"available": "Disponible", "sold": "Vendu"}}
  --   ],
  --   "filters": ["status", "price_range"],
  --   "sortable": true,
  --   "pagination": true,
  --   "actions": ["edit", "view", "delete"]
  -- }

  -- Layout dans le module (grid system 12 colonnes)
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ex: {"x": 0, "y": 0, "w": 6, "h": 4}
  -- x: position horizontale (0-11)
  -- y: position verticale (0+)
  -- w: largeur en colonnes (1-12)
  -- h: hauteur en unités (1+)

  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,

  -- Code généré par l'IA (optionnel, pour widgets complexes)
  generated_code TEXT,
  is_code_generated BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Contraintes
  CONSTRAINT valid_widget_type CHECK (
    widget_type IN (
      'data-table',     -- Tableau de données
      'kpi-card',       -- Carte KPI (métrique)
      'line-chart',     -- Graphique en ligne
      'bar-chart',      -- Graphique en barres
      'pie-chart',      -- Graphique circulaire
      'area-chart',     -- Graphique en aire
      'form',           -- Formulaire
      'calendar',       -- Calendrier
      'map',            -- Carte géographique
      'kanban',         -- Tableau Kanban
      'timeline',       -- Timeline
      'stats-grid',     -- Grille de statistiques
      'progress-bar',   -- Barre de progression
      'list',           -- Liste simple
      'gallery',        -- Galerie d'images
      'custom'          -- Widget personnalisé
    )
  )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_crm_widgets_module ON crm_widgets(module_id);
CREATE INDEX IF NOT EXISTS idx_crm_widgets_type ON crm_widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_crm_widgets_visible ON crm_widgets(module_id, is_visible);

-- Row Level Security
ALTER TABLE crm_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own widgets"
  ON crm_widgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own widgets"
  ON crm_widgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own widgets"
  ON crm_widgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own widgets"
  ON crm_widgets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM crm_modules m
      JOIN build_sessions b ON b.id = m.project_id
      WHERE m.id = crm_widgets.module_id
      AND b.user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. TABLE widget_data
-- =====================================================

CREATE TABLE IF NOT EXISTS public.widget_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES crm_widgets(id) ON DELETE CASCADE NOT NULL,

  -- Données du widget (structure flexible en JSON)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure varie selon le type de widget
  -- Ex pour data-table:
  -- {
  --   "rows": [
  --     {"id": "1", "address": "123 rue Paris", "price": 350000, "status": "available"},
  --     {"id": "2", "address": "456 av Lyon", "price": 450000, "status": "sold"}
  --   ]
  -- }
  -- Ex pour kpi-card:
  -- {
  --   "value": 24,
  --   "trend": "+12%",
  --   "period": "month",
  --   "previous_value": 21
  -- }
  -- Ex pour line-chart:
  -- {
  --   "series": [
  --     {"label": "Janvier", "value": 15000},
  --     {"label": "Février", "value": 18000},
  --     {"label": "Mars", "value": 22000}
  --   ]
  -- }

  -- Métadonnées supplémentaires
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Ex: {"last_import": "2025-01-15", "source": "manual", "version": 1}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_widget_data_widget ON widget_data(widget_id);
CREATE INDEX IF NOT EXISTS idx_widget_data_updated ON widget_data(updated_at DESC);

-- Row Level Security
ALTER TABLE widget_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own widget data"
  ON widget_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own widget data"
  ON widget_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own widget data"
  ON widget_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own widget data"
  ON widget_data FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM crm_widgets w
      JOIN crm_modules m ON m.id = w.module_id
      JOIN build_sessions b ON b.id = m.project_id
      WHERE w.id = widget_data.widget_id
      AND b.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. TRIGGERS pour updated_at
-- =====================================================

-- Trigger pour crm_modules
DROP TRIGGER IF EXISTS handle_crm_modules_updated_at ON crm_modules;
CREATE TRIGGER handle_crm_modules_updated_at
  BEFORE UPDATE ON public.crm_modules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger pour crm_widgets
DROP TRIGGER IF EXISTS handle_crm_widgets_updated_at ON crm_widgets;
CREATE TRIGGER handle_crm_widgets_updated_at
  BEFORE UPDATE ON public.crm_widgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger pour widget_data
DROP TRIGGER IF EXISTS handle_widget_data_updated_at ON widget_data;
CREATE TRIGGER handle_widget_data_updated_at
  BEFORE UPDATE ON public.widget_data
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 6. COMMENTAIRES pour documentation
-- =====================================================

COMMENT ON TABLE crm_modules IS
  'Modules CRM dynamiques générés par l''IA selon le secteur d''activité de l''utilisateur';

COMMENT ON TABLE crm_widgets IS
  'Widgets contenus dans les modules CRM. Chaque widget a un type (table, chart, form, etc.) et une configuration JSON';

COMMENT ON TABLE widget_data IS
  'Données des widgets CRM. Structure flexible en JSONB pour s''adapter à tous les types de widgets';

COMMENT ON COLUMN crm_modules.module_type IS
  'Type de module: inventory, sales, clients, analytics, appointments, contracts, marketing, finance, hr, projects, support, custom';

COMMENT ON COLUMN crm_widgets.widget_type IS
  'Type de widget: data-table, kpi-card, line-chart, bar-chart, pie-chart, form, calendar, map, kanban, timeline, custom';

COMMENT ON COLUMN crm_widgets.config IS
  'Configuration JSON du widget (colonnes pour table, axes pour chart, champs pour form, etc.)';

COMMENT ON COLUMN crm_widgets.layout IS
  'Position et taille du widget dans la grille 12 colonnes: {x, y, w, h}';

COMMENT ON COLUMN widget_data.data IS
  'Données du widget en JSON (rows pour table, value pour KPI, series pour chart, etc.)';
-- Migration: Ajouter les champs pour les widgets dynamiques générés par code
-- Description: Ajoute les champs nécessaires pour supporter la génération de code React dynamique

-- Ajouter les nouveaux champs à la table crm_widgets
ALTER TABLE public.crm_widgets
  ADD COLUMN IF NOT EXISTS generation_prompt TEXT,
  ADD COLUMN IF NOT EXISTS generation_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS code_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}'::jsonb;

-- Ajouter un commentaire pour documentation
COMMENT ON COLUMN public.crm_widgets.generation_prompt IS 'Prompt original de l''utilisateur qui a généré ce widget';
COMMENT ON COLUMN public.crm_widgets.generation_timestamp IS 'Timestamp de la dernière génération/régénération du code';
COMMENT ON COLUMN public.crm_widgets.code_version IS 'Version du code, incrémenté à chaque régénération';
COMMENT ON COLUMN public.crm_widgets.data_sources IS 'Sources de données accessibles au widget : {"site_forms": [], "crm_widgets": [], "external_apis": []}';

-- Index pour optimiser les requêtes par version
CREATE INDEX IF NOT EXISTS idx_crm_widgets_code_version ON public.crm_widgets(code_version);

-- Index pour rechercher par prompt (full-text search)
CREATE INDEX IF NOT EXISTS idx_crm_widgets_generation_prompt ON public.crm_widgets USING gin(to_tsvector('french', generation_prompt));
-- Add missing columns to build_sessions
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS business_sector TEXT,
ADD COLUMN IF NOT EXISTS initial_modules_config JSONB;

-- Create crm_modules table
CREATE TABLE IF NOT EXISTS public.crm_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  module_type TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_module_type CHECK (module_type IN ('inventory', 'sales', 'clients', 'analytics', 'hr', 'projects', 'finance', 'marketing', 'support', 'custom'))
);

-- Create crm_widgets table
CREATE TABLE IF NOT EXISTS public.crm_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.crm_modules(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  layout JSONB DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}',
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_widget_type CHECK (widget_type IN ('data-table', 'kpi-card', 'line-chart', 'bar-chart', 'pie-chart', 'calendar', 'form', 'list', 'stats-grid', 'custom'))
);

-- Create widget_data table
CREATE TABLE IF NOT EXISTS public.widget_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.crm_widgets(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.crm_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_modules
CREATE POLICY "Users can view their project modules" ON public.crm_modules
FOR SELECT USING (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert modules to their projects" ON public.crm_modules
FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their project modules" ON public.crm_modules
FOR UPDATE USING (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their project modules" ON public.crm_modules
FOR DELETE USING (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

-- RLS policies for crm_widgets
CREATE POLICY "Users can view widgets of their modules" ON public.crm_widgets
FOR SELECT USING (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert widgets to their modules" ON public.crm_widgets
FOR INSERT WITH CHECK (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update widgets of their modules" ON public.crm_widgets
FOR UPDATE USING (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete widgets of their modules" ON public.crm_widgets
FOR DELETE USING (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

-- RLS policies for widget_data
CREATE POLICY "Users can view data of their widgets" ON public.widget_data
FOR SELECT USING (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert data to their widgets" ON public.widget_data
FOR INSERT WITH CHECK (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update data of their widgets" ON public.widget_data
FOR UPDATE USING (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete data of their widgets" ON public.widget_data
FOR DELETE USING (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_crm_modules_updated_at
  BEFORE UPDATE ON public.crm_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_widgets_updated_at
  BEFORE UPDATE ON public.crm_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_widget_data_updated_at
  BEFORE UPDATE ON public.widget_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_modules_project_id ON public.crm_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_widgets_module_id ON public.crm_widgets(module_id);
CREATE INDEX IF NOT EXISTS idx_widget_data_widget_id ON public.widget_data(widget_id);-- Add missing columns for dynamic widget generation
ALTER TABLE public.crm_widgets 
ADD COLUMN IF NOT EXISTS generated_code TEXT,
ADD COLUMN IF NOT EXISTS is_code_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS generation_prompt TEXT,
ADD COLUMN IF NOT EXISTS generation_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS code_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}'::jsonb;

-- Drop existing constraint if it exists
ALTER TABLE public.crm_widgets DROP CONSTRAINT IF EXISTS valid_widget_type;

-- Add updated constraint with 'custom' and 'dynamic' types
ALTER TABLE public.crm_widgets ADD CONSTRAINT valid_widget_type 
CHECK (widget_type IN ('kpi', 'table', 'chart', 'form', 'list', 'calendar', 'stats', 'bar_chart', 'line_chart', 'pie_chart', 'custom', 'dynamic'));

-- Create function to increment code version
CREATE OR REPLACE FUNCTION public.increment_code_version(widget_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_version INTEGER;
BEGIN
  UPDATE crm_widgets 
  SET code_version = code_version + 1,
      generation_timestamp = NOW()
  WHERE id = widget_uuid
  RETURNING code_version INTO new_version;
  
  RETURN new_version;
END;
$$;-- Supprimer l'ancienne contrainte et ajouter la nouvelle avec tous les types frontend
ALTER TABLE crm_widgets DROP CONSTRAINT IF EXISTS valid_widget_type;

ALTER TABLE crm_widgets ADD CONSTRAINT valid_widget_type CHECK (
  widget_type = ANY (ARRAY[
    'kpi-card', 'data-table', 'line-chart', 'bar-chart', 'pie-chart', 
    'area-chart', 'form', 'calendar', 'map', 'kanban', 'timeline', 
    'stats-grid', 'progress-bar', 'list', 'gallery', 'custom', 'dynamic'
  ])
);-- Migration: Modèle de données flexible pour CRM bac à sable (inspiré Attio)
-- Description: Remplace le modèle rigide par un modèle JSONB flexible
-- Phase 1 du plan de refonte CRM

-- ============================================================================
-- TABLE: object_definitions
-- Définit les types d'objets dynamiques (équivalent des "tables" personnalisées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  singular_label VARCHAR(100) NOT NULL,
  plural_label VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'box',
  color VARCHAR(20) DEFAULT '#03A5C0',
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  view_config JSONB DEFAULT '{"default":"table","available":["table","kanban","timeline"]}',
  settings JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  generated_by_ai BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Index pour performance
CREATE INDEX idx_object_definitions_project ON object_definitions(project_id);
CREATE INDEX idx_object_definitions_name ON object_definitions(project_id, name);

-- ============================================================================
-- TABLE: custom_objects
-- Stocke les records (instances) des objets avec données flexibles en JSONB
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  object_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (project_id, object_type) REFERENCES object_definitions(project_id, name) ON DELETE CASCADE
);

-- Index GIN pour recherche performante dans JSONB
CREATE INDEX idx_custom_objects_data ON custom_objects USING GIN (data);
CREATE INDEX idx_custom_objects_project_type ON custom_objects(project_id, object_type);
CREATE INDEX idx_custom_objects_created_at ON custom_objects(created_at DESC);

-- ============================================================================
-- TABLE: object_relations
-- Gère les relations entre objets (graph model)
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  source_type VARCHAR(100) NOT NULL,
  source_id UUID NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
  target_type VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
  relation_type VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

-- Index pour performance des requêtes de relations
CREATE INDEX idx_relations_source ON object_relations(source_type, source_id);
CREATE INDEX idx_relations_target ON object_relations(target_type, target_id);
CREATE INDEX idx_relations_project ON object_relations(project_id);

-- ============================================================================
-- TABLE: object_views
-- Stocke les vues personnalisées (filtres, colonnes, tri)
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES build_sessions(id) ON DELETE CASCADE,
  object_type VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  view_type VARCHAR(50) NOT NULL DEFAULT 'table', -- 'table', 'kanban', 'timeline', 'calendar'
  filters JSONB DEFAULT '[]',
  sort_config JSONB DEFAULT '{}',
  visible_fields JSONB DEFAULT '[]',
  layout_config JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (project_id, object_type) REFERENCES object_definitions(project_id, name) ON DELETE CASCADE
);

-- Index pour performance
CREATE INDEX idx_object_views_project_type ON object_views(project_id, object_type);
CREATE INDEX idx_object_views_default ON object_views(project_id, object_type, is_default) WHERE is_default = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Isolation des données par projet et utilisateur
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE object_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_views ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir les objets de leurs projets
CREATE POLICY "Users can view their project object definitions"
  ON object_definitions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create object definitions in their projects"
  ON object_definitions FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their project object definitions"
  ON object_definitions FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project object definitions"
  ON object_definitions FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Politique: Les utilisateurs peuvent gérer les records de leurs projets
CREATE POLICY "Users can view their project custom objects"
  ON custom_objects FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create custom objects in their projects"
  ON custom_objects FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their project custom objects"
  ON custom_objects FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project custom objects"
  ON custom_objects FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Politique: Relations
CREATE POLICY "Users can view their project relations"
  ON object_relations FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their project relations"
  ON object_relations FOR ALL
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Politique: Vues
CREATE POLICY "Users can view their project views"
  ON object_views FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their project views"
  ON object_views FOR ALL
  USING (
    project_id IN (
      SELECT id FROM build_sessions
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS pour updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_object_definitions_updated_at
  BEFORE UPDATE ON object_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_objects_updated_at
  BEFORE UPDATE ON custom_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_object_views_updated_at
  BEFORE UPDATE ON object_views
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTAIRES pour documentation
-- ============================================================================

COMMENT ON TABLE object_definitions IS 'Définitions d''objets dynamiques (types de données personnalisables)';
COMMENT ON TABLE custom_objects IS 'Records (instances) des objets avec données flexibles en JSONB';
COMMENT ON TABLE object_relations IS 'Relations entre objets (graph model avec backlinks)';
COMMENT ON TABLE object_views IS 'Vues personnalisées (filtres, tri, colonnes visibles)';

COMMENT ON COLUMN object_definitions.fields IS 'Array JSONB de définitions de champs avec type, label, config, etc.';
COMMENT ON COLUMN custom_objects.data IS 'Données du record en JSONB (structure définie par object_definitions.fields)';
COMMENT ON COLUMN object_relations.relation_type IS 'Type de relation (ex: "contact_to_company", "deal_to_contact")';
COMMENT ON COLUMN object_views.filters IS 'Array JSONB de conditions de filtre';
COMMENT ON COLUMN object_views.layout_config IS 'Configuration spécifique au type de vue (ex: colonnes kanban, groupBy, etc.)';
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
-- Migration: Intégration VibeSDK - Génération et Billing
-- Crée les tables generations et billing pour le système de crédits

-- ============= Table: generations =============
-- Historique des générations liées aux sessions

CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.build_sessions(id) ON DELETE SET NULL,
  vibesdk_session_id TEXT,
  prompt TEXT NOT NULL,
  code TEXT,
  preview_url TEXT,
  demo_url TEXT,
  deployed_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_session_id ON public.generations(session_id);
CREATE INDEX IF NOT EXISTS idx_generations_vibesdk_session_id ON public.generations(vibesdk_session_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);

-- RLS
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

-- ============= Table: billing =============
-- Suivi de la facturation et des crédits par utilisateur

CREATE TABLE IF NOT EXISTS public.billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  messages_used_this_month INTEGER NOT NULL DEFAULT 0,
  messages_limit INTEGER NOT NULL DEFAULT 5,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(10, 6) DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  billing_cycle_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_billing_user_id ON public.billing(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_plan ON public.billing(plan);

-- RLS
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing"
  ON public.billing FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own billing"
  ON public.billing FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role peut tout faire (pour les edge functions)
CREATE POLICY "Service role full access on billing"
  ON public.billing FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on generations"
  ON public.generations FOR ALL
  USING (auth.role() = 'service_role');

-- ============= Trigger: auto-create billing for new users =============

CREATE OR REPLACE FUNCTION public.create_billing_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.billing (user_id, plan, messages_used_this_month, messages_limit)
  VALUES (NEW.id, 'free', 0, 5)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclencher lors de la création d'un profil
DROP TRIGGER IF EXISTS on_profile_created_create_billing ON public.profiles;
CREATE TRIGGER on_profile_created_create_billing
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_billing_for_new_user();

-- ============= Function: increment messages used =============

CREATE OR REPLACE FUNCTION public.increment_messages_used(p_user_id UUID)
RETURNS TABLE(
  messages_used INTEGER,
  messages_limit INTEGER,
  plan TEXT,
  can_send BOOLEAN
) AS $$
DECLARE
  v_billing RECORD;
BEGIN
  -- Vérifier et reset le cycle si nécessaire
  UPDATE public.billing b
  SET
    messages_used_this_month = CASE
      WHEN b.billing_cycle_end <= now() THEN 1
      ELSE b.messages_used_this_month + 1
    END,
    billing_cycle_start = CASE
      WHEN b.billing_cycle_end <= now() THEN date_trunc('month', now())
      ELSE b.billing_cycle_start
    END,
    billing_cycle_end = CASE
      WHEN b.billing_cycle_end <= now() THEN date_trunc('month', now()) + interval '1 month'
      ELSE b.billing_cycle_end
    END,
    updated_at = now()
  WHERE b.user_id = p_user_id
  RETURNING
    b.messages_used_this_month,
    b.messages_limit,
    b.plan
  INTO v_billing;

  -- Si pas de billing, en créer un
  IF NOT FOUND THEN
    INSERT INTO public.billing (user_id, plan, messages_used_this_month, messages_limit)
    VALUES (p_user_id, 'free', 1, 5)
    RETURNING
      billing.messages_used_this_month,
      billing.messages_limit,
      billing.plan
    INTO v_billing;
  END IF;

  RETURN QUERY SELECT
    v_billing.messages_used_this_month,
    v_billing.messages_limit,
    v_billing.plan,
    (v_billing.messages_used_this_month <= v_billing.messages_limit) AS can_send;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= Function: check user credits =============

CREATE OR REPLACE FUNCTION public.check_user_credits(p_user_id UUID)
RETURNS TABLE(
  messages_used INTEGER,
  messages_limit INTEGER,
  remaining INTEGER,
  plan TEXT,
  can_send BOOLEAN,
  cycle_reset TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.messages_used_this_month,
    b.messages_limit,
    GREATEST(0, b.messages_limit - b.messages_used_this_month),
    b.plan,
    (b.messages_used_this_month < b.messages_limit),
    b.billing_cycle_end
  FROM public.billing b
  WHERE b.user_id = p_user_id;

  -- Si aucun résultat, retourner les valeurs par défaut (free tier)
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      0::INTEGER,
      5::INTEGER,
      5::INTEGER,
      'free'::TEXT,
      true::BOOLEAN,
      (date_trunc('month', now()) + interval '1 month')::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Migration: VibeSDK - Add vibesdk_session_id to build_sessions + usage_stats view
-- (Base vierge: les colonnes v0 n'ont jamais existé, on ajoute directement vibesdk)

-- ============= build_sessions: add vibesdk_session_id =============
ALTER TABLE public.build_sessions
  ADD COLUMN IF NOT EXISTS vibesdk_session_id TEXT;

-- ============= anonymous_chat_log: add vibesdk_session_id =============
-- La table anonymous_chat_log peut ne pas exister encore, on la crée
CREATE TABLE IF NOT EXISTS public.anonymous_chat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  vibesdk_session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============= View: usage_stats =============
CREATE OR REPLACE VIEW public.usage_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  count(*) AS total_chats,
  count(DISTINCT ip_address) AS unique_ips
FROM public.anonymous_chat_log
GROUP BY date_trunc('day', created_at)::date
ORDER BY day DESC;
