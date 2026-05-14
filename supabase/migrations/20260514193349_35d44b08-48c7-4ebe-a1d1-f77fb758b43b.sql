
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente', -- pendente | ativa | atrasada | vencida
  amount numeric NOT NULL DEFAULT 120,
  payment_method text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own sub" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own sub" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own sub" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins view all subs" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage all subs" ON public.subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Payments (simulated history)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 120,
  method text NOT NULL, -- pix | credito | debito | boleto
  status text NOT NULL DEFAULT 'aprovado',
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all sales / animals (for admin dashboard)
CREATE POLICY "admins view all sales" ON public.sales FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins view all animals" ON public.animals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Updated handle_new_user: creates profile + role + pending subscription, and grants admin to special email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = '0001152659@senaimgaluno.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, status, amount)
  VALUES (NEW.id, 'pendente', 120)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: ensure all existing users have a 'user' role and a subscription
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.subscriptions (user_id, status, amount)
SELECT id, 'pendente', 120 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Grant admin to special email (if user already exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = '0001152659@senaimgaluno.com.br'
ON CONFLICT DO NOTHING;

-- Auto-activate admin's subscription
UPDATE public.subscriptions
SET status = 'ativa', started_at = now(), expires_at = now() + interval '100 years'
WHERE user_id IN (SELECT id FROM auth.users WHERE email = '0001152659@senaimgaluno.com.br');
