-- Create project_memory table for persistent context
CREATE TABLE IF NOT EXISTS public.project_memory (
  session_id UUID PRIMARY KEY REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  architecture JSONB DEFAULT '{}'::jsonb,
  recent_changes JSONB[] DEFAULT ARRAY[]::jsonb[],
  known_issues JSONB[] DEFAULT ARRAY[]::jsonb[],
  user_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_memory ON public.project_memory(session_id);

-- Create index on updated_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_memory_updated ON public.project_memory(updated_at DESC);

-- Enable RLS
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;

-- Users can view their own project memory
CREATE POLICY "Users can view own project memory"
ON public.project_memory
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Users can insert their own project memory
CREATE POLICY "Users can insert own project memory"
ON public.project_memory
FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Users can update their own project memory
CREATE POLICY "Users can update own project memory"
ON public.project_memory
FOR UPDATE
USING (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Users can delete their own project memory
CREATE POLICY "Users can delete own project memory"
ON public.project_memory
FOR DELETE
USING (
  session_id IN (
    SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
  )
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_project_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_memory_timestamp
BEFORE UPDATE ON public.project_memory
FOR EACH ROW
EXECUTE FUNCTION update_project_memory_updated_at();