-- =============================================
-- MIGRATION V0.APP - Schéma pour intégration V0 Platform API
-- =============================================

-- 1. Modifier la table build_sessions pour ajouter les colonnes V0
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS v0_chat_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS v0_project_id TEXT;

-- Index pour performance sur v0_chat_id
CREATE INDEX IF NOT EXISTS idx_build_sessions_v0_chat_id ON public.build_sessions(v0_chat_id);

-- 2. Créer la table pour tracking des chats anonymes (rate limiting)
CREATE TABLE IF NOT EXISTS public.anonymous_chat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  v0_chat_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour rate limiting par IP
CREATE INDEX IF NOT EXISTS idx_anonymous_chat_log_ip 
ON public.anonymous_chat_log(ip_address, created_at);

-- Activer RLS
ALTER TABLE public.anonymous_chat_log ENABLE ROW LEVEL SECURITY;

-- Politique pour insertion uniquement (pas de lecture pour les anonymes)
CREATE POLICY "Allow insert for anonymous rate limiting" 
ON public.anonymous_chat_log 
FOR INSERT 
WITH CHECK (true);

-- 3. Créer la table pour utilisateurs guests
CREATE TABLE IF NOT EXISTS public.guest_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour session token
CREATE INDEX IF NOT EXISTS idx_guest_users_session_token 
ON public.guest_users(session_token);

-- Activer RLS
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

-- Politique pour guest users
CREATE POLICY "Guest users can manage their own data" 
ON public.guest_users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 4. Créer la table pour rate limiting des utilisateurs
CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chats_today INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

-- Politique pour rate limits
CREATE POLICY "Users can view their own rate limits" 
ON public.user_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own rate limits" 
ON public.user_rate_limits 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate limits" 
ON public.user_rate_limits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Créer une vue pour les statistiques V0 (admin)
CREATE OR REPLACE VIEW public.v0_usage_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_chats,
  COUNT(DISTINCT ip_address) as unique_ips
FROM public.anonymous_chat_log
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;