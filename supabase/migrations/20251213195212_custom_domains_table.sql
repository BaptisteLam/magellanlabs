-- Create custom_domains table for Domain Connect
CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES build_sessions(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  cloudflare_project_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dns_verified BOOLEAN DEFAULT false,
  method TEXT NOT NULL,
  provider_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'failed')),
  CONSTRAINT valid_method CHECK (method IN ('automatic', 'manual'))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_domains_user ON custom_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_session ON custom_domains(session_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

-- Enable Row Level Security
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own domains"
  ON custom_domains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own domains"
  ON custom_domains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domains"
  ON custom_domains FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own domains"
  ON custom_domains FOR DELETE
  USING (auth.uid() = user_id);
