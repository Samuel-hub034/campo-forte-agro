
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  plans text[] NOT NULL DEFAULT ARRAY['mensal','trimestral','anual']::text[],
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read active promos"
  ON public.promotions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins manage promotions"
  ON public.promotions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- subscriptions: add plan period column
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'mensal';

-- Allow inserting with any of the 3 plans (replace strict policy)
DROP POLICY IF EXISTS "users insert own sub safe defaults" ON public.subscriptions;
CREATE POLICY "users insert own sub safe defaults"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pendente'
    AND expires_at IS NULL
    AND started_at IS NULL
    AND plan IN ('mensal','trimestral','anual')
  );
