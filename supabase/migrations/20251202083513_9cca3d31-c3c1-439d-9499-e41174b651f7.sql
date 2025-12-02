-- Fix search_path security warning for update_project_memory_updated_at function
CREATE OR REPLACE FUNCTION public.update_project_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER;