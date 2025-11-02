-- Add thumbnail_url column to build_sessions table
ALTER TABLE public.build_sessions
ADD COLUMN thumbnail_url text;

-- Add thumbnail_url column to websites table  
ALTER TABLE public.websites
ADD COLUMN thumbnail_url text;