-- Add web_analytics_site_token column to build_sessions for Cloudflare Web Analytics
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS web_analytics_site_token TEXT;