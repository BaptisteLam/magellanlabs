-- Add website_id column to build_sessions to link sessions to published websites
ALTER TABLE public.build_sessions
ADD COLUMN IF NOT EXISTS website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL;