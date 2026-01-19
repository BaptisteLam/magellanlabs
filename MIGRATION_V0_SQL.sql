-- ============================================================================
-- MIGRATION VERS V0.APP - SCRIPTS SQL
-- ============================================================================
-- Date: 2026-01-19
-- Description: Modifications de la base de données pour intégrer V0.App
--
-- ATTENTION: Exécuter ces scripts dans l'ordre
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: BACKUP DES DONNÉES EXISTANTES
-- ============================================================================
-- Créer des tables de backup avant toute modification

CREATE TABLE IF NOT EXISTS build_sessions_backup AS
SELECT * FROM build_sessions;

CREATE TABLE IF NOT EXISTS chat_messages_backup AS
SELECT * FROM chat_messages;

-- Vérifier les backups
-- SELECT COUNT(*) FROM build_sessions_backup;
-- SELECT COUNT(*) FROM chat_messages_backup;

-- ============================================================================
-- ÉTAPE 2: CRÉER LES NOUVELLES TABLES V0
-- ============================================================================

-- Table pour tracking des chats anonymes (rate limiting)
CREATE TABLE IF NOT EXISTS anonymous_chat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  v0_chat_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance (queries par IP et date)
CREATE INDEX IF NOT EXISTS idx_anonymous_chat_log_ip
ON anonymous_chat_log(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anonymous_chat_log_date
ON anonymous_chat_log(created_at DESC);

-- Table pour utilisateurs guests (auto-générés)
CREATE TABLE IF NOT EXISTS guest_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche par token
CREATE INDEX IF NOT EXISTS idx_guest_users_token
ON guest_users(session_token);

-- Table pour rate limiting par utilisateur
CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chats_today INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour queries de rate limit
CREATE INDEX IF NOT EXISTS idx_user_rate_limits_reset
ON user_rate_limits(last_reset DESC);

-- ============================================================================
-- ÉTAPE 3: MODIFIER LA TABLE build_sessions
-- ============================================================================

-- Ajouter les nouvelles colonnes V0
ALTER TABLE build_sessions
  ADD COLUMN IF NOT EXISTS v0_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS v0_project_id TEXT;

-- Créer un index unique sur v0_chat_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_build_sessions_v0_chat_id
ON build_sessions(v0_chat_id) WHERE v0_chat_id IS NOT NULL;

-- Index pour v0_project_id
CREATE INDEX IF NOT EXISTS idx_build_sessions_v0_project_id
ON build_sessions(v0_project_id) WHERE v0_project_id IS NOT NULL;

-- Supprimer les colonnes devenues obsolètes (V0 est la source de vérité)
-- ATTENTION: Décommenter uniquement après migration complète et tests
-- ALTER TABLE build_sessions
--   DROP COLUMN IF EXISTS html_content,
--   DROP COLUMN IF EXISTS messages,
--   DROP COLUMN IF EXISTS project_files;

-- Pour l'instant, on peut les rendre nullables
ALTER TABLE build_sessions
  ALTER COLUMN html_content DROP NOT NULL,
  ALTER COLUMN messages DROP NOT NULL,
  ALTER COLUMN project_files DROP NOT NULL;

-- Ajouter une colonne pour tracker le statut de migration
ALTER TABLE build_sessions
  ADD COLUMN IF NOT EXISTS migrated_to_v0 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migration_date TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- ÉTAPE 4: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE anonymous_chat_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rate_limits ENABLE ROW LEVEL SECURITY;

-- Politique pour anonymous_chat_log (admins seulement)
CREATE POLICY "anonymous_chat_log_admin_only" ON anonymous_chat_log
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Politique pour guest_users (lecture propre session + admins)
CREATE POLICY "guest_users_read_own" ON guest_users
  FOR SELECT
  USING (
    session_token = current_setting('request.headers')::json->>'x-session-token'
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Politique pour user_rate_limits (lecture propres données)
CREATE POLICY "user_rate_limits_read_own" ON user_rate_limits
  FOR SELECT
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "user_rate_limits_update_own" ON user_rate_limits
  FOR UPDATE
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Politique pour build_sessions (ownership V0)
-- Les utilisateurs ne peuvent voir que leurs propres sessions
DROP POLICY IF EXISTS "build_sessions_user_access" ON build_sessions;
CREATE POLICY "build_sessions_user_access" ON build_sessions
  FOR ALL
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================================================
-- ÉTAPE 5: MIGRATION DES DONNÉES EXISTANTES
-- ============================================================================

-- Générer des v0_chat_id temporaires pour les sessions existantes
-- (Sera remplacé lors de la première synchronisation avec V0)
UPDATE build_sessions
SET
  v0_chat_id = 'legacy_' || id::text,
  migrated_to_v0 = FALSE
WHERE v0_chat_id IS NULL;

-- ============================================================================
-- ÉTAPE 6: FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour nettoyer les logs anonymes anciens (>30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_anonymous_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM anonymous_chat_log
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réinitialiser les rate limits quotidiens
CREATE OR REPLACE FUNCTION reset_daily_rate_limits()
RETURNS void AS $$
BEGIN
  UPDATE user_rate_limits
  SET
    chats_today = 0,
    last_reset = NOW()
  WHERE last_reset < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour récupérer le quota restant d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_remaining_quota(p_user_id UUID)
RETURNS TABLE(
  user_type TEXT,
  daily_limit INTEGER,
  used_today INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
  v_reset TIMESTAMP WITH TIME ZONE;
  v_user_type TEXT;
BEGIN
  -- Déterminer le type d'utilisateur
  IF p_user_id IS NULL THEN
    v_user_type := 'anonymous';
    v_limit := 3;
    RETURN QUERY SELECT v_user_type, v_limit, 0, v_limit, NOW() + INTERVAL '24 hours';
    RETURN;
  END IF;

  -- Vérifier si c'est un guest
  IF EXISTS (SELECT 1 FROM guest_users WHERE id = p_user_id) THEN
    v_user_type := 'guest';
    v_limit := 5;
  ELSE
    v_user_type := 'registered';
    v_limit := 50;
  END IF;

  -- Récupérer les données de rate limit
  SELECT chats_today, last_reset
  INTO v_used, v_reset
  FROM user_rate_limits
  WHERE user_id = p_user_id;

  -- Si pas de record, créer un nouveau
  IF NOT FOUND THEN
    v_used := 0;
    v_reset := NOW();
    INSERT INTO user_rate_limits (user_id, chats_today, last_reset)
    VALUES (p_user_id, 0, NOW());
  END IF;

  -- Si reset nécessaire (>24h)
  IF v_reset < NOW() - INTERVAL '24 hours' THEN
    v_used := 0;
    v_reset := NOW();
    UPDATE user_rate_limits
    SET chats_today = 0, last_reset = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT
    v_user_type,
    v_limit,
    v_used,
    GREATEST(0, v_limit - v_used),
    v_reset + INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ÉTAPE 7: TRIGGERS
-- ============================================================================

-- Trigger pour mettre à jour last_active sur guest_users
CREATE OR REPLACE FUNCTION update_guest_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE guest_users
  SET last_active = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_guest_active ON build_sessions;
CREATE TRIGGER trigger_update_guest_active
  AFTER INSERT ON build_sessions
  FOR EACH ROW
  WHEN (EXISTS (SELECT 1 FROM guest_users WHERE id = NEW.user_id))
  EXECUTE FUNCTION update_guest_last_active();

-- ============================================================================
-- ÉTAPE 8: CLEANUP SCHEDULED JOBS (pg_cron)
-- ============================================================================

-- Note: Nécessite l'extension pg_cron
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job quotidien pour nettoyer les logs anonymes
-- SELECT cron.schedule(
--   'cleanup-anonymous-logs',
--   '0 2 * * *',  -- 2h du matin chaque jour
--   $$ SELECT cleanup_old_anonymous_logs(); $$
-- );

-- Job pour réinitialiser les rate limits
-- SELECT cron.schedule(
--   'reset-rate-limits',
--   '0 0 * * *',  -- Minuit chaque jour
--   $$ SELECT reset_daily_rate_limits(); $$
-- );

-- ============================================================================
-- ÉTAPE 9: VUES UTILITAIRES
-- ============================================================================

-- Vue pour monitoring du rate limiting
CREATE OR REPLACE VIEW v_rate_limit_monitoring AS
SELECT
  u.id as user_id,
  u.email,
  CASE
    WHEN gu.id IS NOT NULL THEN 'guest'
    ELSE 'registered'
  END as user_type,
  COALESCE(rl.chats_today, 0) as chats_today,
  COALESCE(rl.last_reset, NOW()) as last_reset,
  CASE
    WHEN gu.id IS NOT NULL THEN 5
    ELSE 50
  END as daily_limit,
  CASE
    WHEN gu.id IS NOT NULL THEN GREATEST(0, 5 - COALESCE(rl.chats_today, 0))
    ELSE GREATEST(0, 50 - COALESCE(rl.chats_today, 0))
  END as remaining_quota
FROM auth.users u
LEFT JOIN guest_users gu ON gu.id = u.id
LEFT JOIN user_rate_limits rl ON rl.user_id = u.id;

-- Vue pour statistiques anonymes
CREATE OR REPLACE VIEW v_anonymous_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_chats,
  COUNT(DISTINCT ip_address) as unique_ips
FROM anonymous_chat_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- ÉTAPE 10: SUPPRESSION DES ANCIENNES TABLES (APRÈS MIGRATION COMPLÈTE)
-- ============================================================================

-- ATTENTION: Ne décommenter qu'après migration complète et tests validés
-- DROP TABLE IF EXISTS chat_messages CASCADE;

-- Si besoin de rollback, les backups sont disponibles :
-- INSERT INTO chat_messages SELECT * FROM chat_messages_backup;

-- ============================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- ============================================================================

-- Vérifier les nouvelles tables
SELECT 'anonymous_chat_log' as table_name, COUNT(*) as row_count FROM anonymous_chat_log
UNION ALL
SELECT 'guest_users', COUNT(*) FROM guest_users
UNION ALL
SELECT 'user_rate_limits', COUNT(*) FROM user_rate_limits
UNION ALL
SELECT 'build_sessions', COUNT(*) FROM build_sessions
UNION ALL
SELECT 'build_sessions_backup', COUNT(*) FROM build_sessions_backup;

-- Vérifier les colonnes v0
SELECT
  COUNT(*) as total_sessions,
  COUNT(v0_chat_id) as with_v0_chat_id,
  COUNT(v0_project_id) as with_v0_project_id,
  SUM(CASE WHEN migrated_to_v0 THEN 1 ELSE 0 END) as migrated_count
FROM build_sessions;

-- Vérifier les index
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('build_sessions', 'anonymous_chat_log', 'guest_users', 'user_rate_limits')
ORDER BY tablename, indexname;

-- Vérifier les policies RLS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('build_sessions', 'anonymous_chat_log', 'guest_users', 'user_rate_limits')
ORDER BY tablename, policyname;

-- ============================================================================
-- ROLLBACK (EN CAS DE PROBLÈME)
-- ============================================================================

-- Si besoin de rollback complet :
/*
-- 1. Restaurer les données
DROP TABLE IF EXISTS build_sessions CASCADE;
ALTER TABLE build_sessions_backup RENAME TO build_sessions;

-- 2. Supprimer les nouvelles tables
DROP TABLE IF EXISTS anonymous_chat_log CASCADE;
DROP TABLE IF EXISTS guest_users CASCADE;
DROP TABLE IF EXISTS user_rate_limits CASCADE;

-- 3. Supprimer les fonctions
DROP FUNCTION IF EXISTS cleanup_old_anonymous_logs() CASCADE;
DROP FUNCTION IF EXISTS reset_daily_rate_limits() CASCADE;
DROP FUNCTION IF EXISTS get_user_remaining_quota(UUID) CASCADE;

-- 4. Supprimer les vues
DROP VIEW IF EXISTS v_rate_limit_monitoring CASCADE;
DROP VIEW IF EXISTS v_anonymous_stats CASCADE;
*/

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

-- Marquer la migration comme complète
CREATE TABLE IF NOT EXISTS migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

INSERT INTO migration_log (migration_name, notes)
VALUES (
  'v0_app_integration',
  'Migration vers V0.App: Ajout tables anonymous_chat_log, guest_users, user_rate_limits. Modification build_sessions avec colonnes v0_chat_id et v0_project_id.'
);

-- Afficher un résumé
SELECT
  'Migration V0.App complétée avec succès!' as status,
  NOW() as timestamp;
