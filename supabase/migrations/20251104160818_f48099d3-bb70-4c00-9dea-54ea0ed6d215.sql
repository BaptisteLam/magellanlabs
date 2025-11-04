-- Add Google Analytics columns to websites table
ALTER TABLE public.websites
ADD COLUMN IF NOT EXISTS ga_property_id TEXT,
ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT;