-- Migration: Intégration v0 Platform API
-- Ajoute les tables generations et billing pour le système de crédits

-- ============= Table: generations =============
-- Historique des générations v0 liées aux sessions

CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.build_sessions(id) ON DELETE SET NULL,
  v0_chat_id TEXT,
  v0_project_id TEXT,
  prompt TEXT NOT NULL,
  code TEXT,
  preview_url TEXT,
  demo_url TEXT,
  deployed_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_session_id ON public.generations(session_id);
CREATE INDEX IF NOT EXISTS idx_generations_v0_chat_id ON public.generations(v0_chat_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);

-- RLS
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

-- ============= Table: billing =============
-- Suivi de la facturation et des crédits par utilisateur

CREATE TABLE IF NOT EXISTS public.billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  messages_used_this_month INTEGER NOT NULL DEFAULT 0,
  messages_limit INTEGER NOT NULL DEFAULT 5,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(10, 6) DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  billing_cycle_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_billing_user_id ON public.billing(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_plan ON public.billing(plan);

-- RLS
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing"
  ON public.billing FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own billing"
  ON public.billing FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role peut tout faire (pour les edge functions)
CREATE POLICY "Service role full access on billing"
  ON public.billing FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on generations"
  ON public.generations FOR ALL
  USING (auth.role() = 'service_role');

-- ============= Trigger: auto-create billing for new users =============

CREATE OR REPLACE FUNCTION public.create_billing_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.billing (user_id, plan, messages_used_this_month, messages_limit)
  VALUES (NEW.id, 'free', 0, 5)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclencher lors de la création d'un profil
DROP TRIGGER IF EXISTS on_profile_created_create_billing ON public.profiles;
CREATE TRIGGER on_profile_created_create_billing
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_billing_for_new_user();

-- ============= Function: increment messages used =============

CREATE OR REPLACE FUNCTION public.increment_messages_used(p_user_id UUID)
RETURNS TABLE(
  messages_used INTEGER,
  messages_limit INTEGER,
  plan TEXT,
  can_send BOOLEAN
) AS $$
DECLARE
  v_billing RECORD;
BEGIN
  -- Vérifier et reset le cycle si nécessaire
  UPDATE public.billing b
  SET
    messages_used_this_month = CASE
      WHEN b.billing_cycle_end <= now() THEN 1
      ELSE b.messages_used_this_month + 1
    END,
    billing_cycle_start = CASE
      WHEN b.billing_cycle_end <= now() THEN date_trunc('month', now())
      ELSE b.billing_cycle_start
    END,
    billing_cycle_end = CASE
      WHEN b.billing_cycle_end <= now() THEN date_trunc('month', now()) + interval '1 month'
      ELSE b.billing_cycle_end
    END,
    updated_at = now()
  WHERE b.user_id = p_user_id
  RETURNING
    b.messages_used_this_month,
    b.messages_limit,
    b.plan
  INTO v_billing;

  -- Si pas de billing, en créer un
  IF NOT FOUND THEN
    INSERT INTO public.billing (user_id, plan, messages_used_this_month, messages_limit)
    VALUES (p_user_id, 'free', 1, 5)
    RETURNING
      billing.messages_used_this_month,
      billing.messages_limit,
      billing.plan
    INTO v_billing;
  END IF;

  RETURN QUERY SELECT
    v_billing.messages_used_this_month,
    v_billing.messages_limit,
    v_billing.plan,
    (v_billing.messages_used_this_month <= v_billing.messages_limit) AS can_send;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= Function: check user credits =============

CREATE OR REPLACE FUNCTION public.check_user_credits(p_user_id UUID)
RETURNS TABLE(
  messages_used INTEGER,
  messages_limit INTEGER,
  remaining INTEGER,
  plan TEXT,
  can_send BOOLEAN,
  cycle_reset TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.messages_used_this_month,
    b.messages_limit,
    GREATEST(0, b.messages_limit - b.messages_used_this_month),
    b.plan,
    (b.messages_used_this_month < b.messages_limit),
    b.billing_cycle_end
  FROM public.billing b
  WHERE b.user_id = p_user_id;

  -- Si aucun résultat, retourner les valeurs par défaut (free tier)
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      0::INTEGER,
      5::INTEGER,
      5::INTEGER,
      'free'::TEXT,
      true::BOOLEAN,
      (date_trunc('month', now()) + interval '1 month')::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
