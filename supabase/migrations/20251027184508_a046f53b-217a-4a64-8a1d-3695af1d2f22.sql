-- Delete all anonymous sessions (user_id IS NULL) to prepare for constraint
DELETE FROM public.build_sessions WHERE user_id IS NULL;

-- Drop old policies that allow NULL user_id
DROP POLICY IF EXISTS "Users can create sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions or anonymous sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.build_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.build_sessions;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can create their own sessions"
ON public.build_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their own sessions"
ON public.build_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own sessions"
ON public.build_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own sessions"
ON public.build_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Make user_id NOT NULL to enforce authentication
ALTER TABLE public.build_sessions 
ALTER COLUMN user_id SET NOT NULL;