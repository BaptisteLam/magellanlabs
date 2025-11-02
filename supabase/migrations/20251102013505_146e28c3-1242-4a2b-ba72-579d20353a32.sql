-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true);

-- Create RLS policies for screenshots bucket
CREATE POLICY "Screenshots are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');