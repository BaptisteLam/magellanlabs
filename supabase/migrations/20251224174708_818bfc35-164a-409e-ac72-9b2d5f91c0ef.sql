-- Add missing columns for dynamic widget generation
ALTER TABLE public.crm_widgets 
ADD COLUMN IF NOT EXISTS generated_code TEXT,
ADD COLUMN IF NOT EXISTS is_code_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS generation_prompt TEXT,
ADD COLUMN IF NOT EXISTS generation_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS code_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}'::jsonb;

-- Drop existing constraint if it exists
ALTER TABLE public.crm_widgets DROP CONSTRAINT IF EXISTS valid_widget_type;

-- Add updated constraint with 'custom' and 'dynamic' types
ALTER TABLE public.crm_widgets ADD CONSTRAINT valid_widget_type 
CHECK (widget_type IN ('kpi', 'table', 'chart', 'form', 'list', 'calendar', 'stats', 'bar_chart', 'line_chart', 'pie_chart', 'custom', 'dynamic'));

-- Create function to increment code version
CREATE OR REPLACE FUNCTION public.increment_code_version(widget_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_version INTEGER;
BEGIN
  UPDATE crm_widgets 
  SET code_version = code_version + 1,
      generation_timestamp = NOW()
  WHERE id = widget_uuid
  RETURNING code_version INTO new_version;
  
  RETURN new_version;
END;
$$;