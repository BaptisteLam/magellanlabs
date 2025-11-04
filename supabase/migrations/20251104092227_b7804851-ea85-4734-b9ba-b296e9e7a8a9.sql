-- Add Netlify deployment fields to build_sessions table
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS netlify_site_id TEXT,
ADD COLUMN IF NOT EXISTS netlify_deployment_url TEXT;

-- Add Netlify deployment fields to websites table
ALTER TABLE public.websites 
ADD COLUMN IF NOT EXISTS netlify_site_id TEXT,
ADD COLUMN IF NOT EXISTS netlify_url TEXT;