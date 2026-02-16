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
