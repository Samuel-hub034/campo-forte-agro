
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  farm_name TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Animals
CREATE TABLE public.animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT,
  type TEXT NOT NULL,
  breed TEXT,
  birth_date DATE,
  weight_kg NUMERIC,
  lote TEXT,
  origin TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select animals" ON public.animals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner insert animals" ON public.animals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update animals" ON public.animals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner delete animals" ON public.animals FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX animals_user_id_idx ON public.animals(user_id);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'animal' | 'grao' | 'outro'
  item TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  buyer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select sales" ON public.sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner insert sales" ON public.sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update sales" ON public.sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner delete sales" ON public.sales FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX sales_user_date_idx ON public.sales(user_id, sale_date DESC);

-- Market prices (public read for authenticated users)
CREATE TABLE public.market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  unit TEXT NOT NULL,
  region TEXT NOT NULL,
  price NUMERIC NOT NULL,
  variation NUMERIC DEFAULT 0,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any auth user reads prices" ON public.market_prices FOR SELECT TO authenticated USING (true);

-- Seed sample market prices
INSERT INTO public.market_prices (product, unit, region, price, variation) VALUES
  ('Boi Gordo', 'arroba', 'Sudeste', 312.50, 1.20),
  ('Boi Gordo', 'arroba', 'Centro-Oeste', 305.00, -0.80),
  ('Boi Gordo', 'arroba', 'Norte', 298.00, 0.50),
  ('Vaca Gorda', 'arroba', 'Sudeste', 285.00, 0.90),
  ('Soja', 'saca 60kg', 'Centro-Oeste', 128.40, -1.10),
  ('Milho', 'saca 60kg', 'Centro-Oeste', 62.30, 2.40),
  ('Café Arábica', 'saca 60kg', 'Sudeste', 1850.00, 3.10),
  ('Bezerro', 'cabeça', 'Centro-Oeste', 2450.00, 1.50);
