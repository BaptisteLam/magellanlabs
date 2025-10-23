-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create build_sessions table to store unique generation sessions
CREATE TABLE IF NOT EXISTS public.build_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  html_content TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.build_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own sessions and allow anonymous users to view sessions they created
CREATE POLICY "Users can view their own sessions or anonymous sessions"
ON public.build_sessions
FOR SELECT
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Allow users to insert their own sessions
CREATE POLICY "Users can create sessions"
ON public.build_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);

-- Allow users to update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.build_sessions
FOR UPDATE
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Allow users to delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON public.build_sessions
FOR DELETE
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_build_sessions_updated_at
BEFORE UPDATE ON public.build_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();