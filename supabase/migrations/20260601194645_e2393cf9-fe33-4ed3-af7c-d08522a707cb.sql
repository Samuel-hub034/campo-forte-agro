-- Add trial fields to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_fingerprint text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Allow 'trial' as a valid status by relaxing insert policy
DROP POLICY IF EXISTS "users insert own sub safe defaults" ON public.subscriptions;
CREATE POLICY "users insert own sub safe defaults"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pendente','trial')
    AND plan = ANY (ARRAY['mensal','trimestral','anual'])
  );

-- Allow user to update their own sub to cancel auto_renew / status
CREATE POLICY "users update own sub limited"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pendente','trial','cancelada')
  );

-- Anti-abuse: registry of trial usage by email + card fingerprint
CREATE TABLE IF NOT EXISTS public.trial_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  card_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email),
  UNIQUE (card_fingerprint)
);

GRANT SELECT, INSERT ON public.trial_usage TO authenticated;
GRANT ALL ON public.trial_usage TO service_role;

ALTER TABLE public.trial_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own trial usage"
  ON public.trial_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own trial usage"
  ON public.trial_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all trial usage"
  ON public.trial_usage FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
