-- Add project_icon column to build_sessions
ALTER TABLE public.build_sessions 
ADD COLUMN project_icon text DEFAULT NULL;

-- Create storage bucket for project icons if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-icons', 'project-icons', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for project icons bucket - anyone can view
CREATE POLICY "Project icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-icons');

-- Users can upload their own project icons
CREATE POLICY "Users can upload project icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-icons' 
  AND auth.uid() IS NOT NULL
);

-- Users can update their own project icons
CREATE POLICY "Users can update project icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-icons' 
  AND auth.uid() IS NOT NULL
);

-- Users can delete their own project icons
CREATE POLICY "Users can delete project icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-icons' 
  AND auth.uid() IS NOT NULL
);