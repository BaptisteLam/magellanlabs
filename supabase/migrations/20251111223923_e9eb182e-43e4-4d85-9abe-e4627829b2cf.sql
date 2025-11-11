-- Add Cloudflare deployment columns to build_sessions and websites tables
ALTER TABLE build_sessions 
ADD COLUMN IF NOT EXISTS cloudflare_project_name TEXT,
ADD COLUMN IF NOT EXISTS cloudflare_deployment_url TEXT;

ALTER TABLE websites 
ADD COLUMN IF NOT EXISTS cloudflare_project_name TEXT,
ADD COLUMN IF NOT EXISTS cloudflare_url TEXT;