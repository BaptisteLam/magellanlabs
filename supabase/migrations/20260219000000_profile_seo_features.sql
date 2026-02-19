-- Migration: Add profile display_name/avatar_url and seo_descriptions to build_sessions

-- Add display_name and avatar_url to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add seo_descriptions to build_sessions table
ALTER TABLE build_sessions
  ADD COLUMN IF NOT EXISTS seo_descriptions JSONB DEFAULT '{}';

-- Update the updated_at trigger for profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
