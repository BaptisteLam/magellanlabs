-- Migration: Migrate from V0 Platform to Cloudflare VibeSDK
-- Renames v0-specific columns to vibesdk equivalents

-- ============= anonymous_chat_log =============
ALTER TABLE public.anonymous_chat_log
  RENAME COLUMN v0_chat_id TO vibesdk_session_id;

-- ============= build_sessions =============
-- Add new column, copy data, drop old columns
ALTER TABLE public.build_sessions
  ADD COLUMN IF NOT EXISTS vibesdk_session_id TEXT;

UPDATE public.build_sessions
  SET vibesdk_session_id = v0_chat_id
  WHERE v0_chat_id IS NOT NULL;

ALTER TABLE public.build_sessions
  DROP COLUMN IF EXISTS v0_chat_id,
  DROP COLUMN IF EXISTS v0_project_id;

-- ============= generations =============
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS vibesdk_session_id TEXT;

UPDATE public.generations
  SET vibesdk_session_id = v0_chat_id
  WHERE v0_chat_id IS NOT NULL;

-- Drop old index
DROP INDEX IF EXISTS idx_generations_v0_chat_id;

ALTER TABLE public.generations
  DROP COLUMN IF EXISTS v0_chat_id,
  DROP COLUMN IF EXISTS v0_project_id;

-- Create new index
CREATE INDEX IF NOT EXISTS idx_generations_vibesdk_session_id ON public.generations(vibesdk_session_id);

-- ============= Rename view =============
DROP VIEW IF EXISTS public.v0_usage_stats;

CREATE OR REPLACE VIEW public.usage_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  count(*) AS total_chats,
  count(DISTINCT ip_address) AS unique_ips
FROM public.anonymous_chat_log
GROUP BY date_trunc('day', created_at)::date
ORDER BY day DESC;
