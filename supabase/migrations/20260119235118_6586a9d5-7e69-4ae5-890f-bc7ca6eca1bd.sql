-- Correction de la vue pour utiliser security_invoker au lieu de security_definer
DROP VIEW IF EXISTS public.v0_usage_stats;

CREATE VIEW public.v0_usage_stats 
WITH (security_invoker = true) AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_chats,
  COUNT(DISTINCT ip_address) as unique_ips
FROM public.anonymous_chat_log
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Note: Les politiques RLS "USING (true)" pour anonymous_chat_log et guest_users
-- sont intentionnelles car ces tables sont gérées par le backend (edge functions)
-- et non par les utilisateurs directement. Le rate limiting nécessite ces insertions.