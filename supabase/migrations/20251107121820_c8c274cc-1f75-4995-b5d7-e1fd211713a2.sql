-- Table pour stocker les messages de chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour recherche rapide par session
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own chat messages"
  ON public.chat_messages
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.build_sessions WHERE user_id = auth.uid()
    )
  );