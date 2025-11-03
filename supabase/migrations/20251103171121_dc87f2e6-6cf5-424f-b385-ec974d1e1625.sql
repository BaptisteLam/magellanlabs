-- Add cloudflare_project_name column to build_sessions table
ALTER TABLE public.build_sessions 
ADD COLUMN cloudflare_project_name TEXT,
ADD COLUMN cloudflare_deployment_url TEXT;