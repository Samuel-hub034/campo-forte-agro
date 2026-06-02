-- 1) Estados x produtos (preço atual)
CREATE TABLE public.market_prices_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  state text NOT NULL,
  region text NOT NULL,
  unit text NOT NULL,
  price numeric NOT NULL,
  variation_day numeric NOT NULL DEFAULT 0,
  variation_week numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'Simulado',
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, state)
);

GRANT SELECT ON public.market_prices_states TO authenticated;
GRANT ALL ON public.market_prices_states TO service_role;

ALTER TABLE public.market_prices_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read prices_states"
ON public.market_prices_states FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_mps_product ON public.market_prices_states(product);
CREATE INDEX idx_mps_state ON public.market_prices_states(state);

-- 2) Histórico de preços
CREATE TABLE public.market_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  state text NOT NULL,
  price numeric NOT NULL,
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, state, reference_date)
);

GRANT SELECT ON public.market_price_history TO authenticated;
GRANT ALL ON public.market_price_history TO service_role;

ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read price_history"
ON public.market_price_history FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_mph_product_state_date ON public.market_price_history(product, state, reference_date DESC);

-- 3) Seed: produtos x estados x histórico (60 dias)
DO $$
DECLARE
  products jsonb := '[
    {"name":"Boi Gordo","unit":"@","base":310},
    {"name":"Bezerro","unit":"cab","base":2400},
    {"name":"Vaca Gorda","unit":"@","base":275},
    {"name":"Leite","unit":"L","base":2.45},
    {"name":"Soja","unit":"sc 60kg","base":135},
    {"name":"Milho","unit":"sc 60kg","base":68},
    {"name":"Café Arábica","unit":"sc 60kg","base":1850},
    {"name":"Trigo","unit":"sc 60kg","base":78},
    {"name":"Algodão","unit":"@","base":145}
  ]'::jsonb;
  states jsonb := '[
    {"uf":"AC","region":"Norte"},{"uf":"AL","region":"Nordeste"},{"uf":"AP","region":"Norte"},
    {"uf":"AM","region":"Norte"},{"uf":"BA","region":"Nordeste"},{"uf":"CE","region":"Nordeste"},
    {"uf":"DF","region":"Centro-Oeste"},{"uf":"ES","region":"Sudeste"},{"uf":"GO","region":"Centro-Oeste"},
    {"uf":"MA","region":"Nordeste"},{"uf":"MT","region":"Centro-Oeste"},{"uf":"MS","region":"Centro-Oeste"},
    {"uf":"MG","region":"Sudeste"},{"uf":"PA","region":"Norte"},{"uf":"PB","region":"Nordeste"},
    {"uf":"PR","region":"Sul"},{"uf":"PE","region":"Nordeste"},{"uf":"PI","region":"Nordeste"},
    {"uf":"RJ","region":"Sudeste"},{"uf":"RN","region":"Nordeste"},{"uf":"RS","region":"Sul"},
    {"uf":"RO","region":"Norte"},{"uf":"RR","region":"Norte"},{"uf":"SC","region":"Sul"},
    {"uf":"SP","region":"Sudeste"},{"uf":"SE","region":"Nordeste"},{"uf":"TO","region":"Norte"}
  ]'::jsonb;
  p jsonb; s jsonb;
  base numeric; price numeric; prev numeric;
  i int;
  d date;
BEGIN
  FOR p IN SELECT * FROM jsonb_array_elements(products) LOOP
    FOR s IN SELECT * FROM jsonb_array_elements(states) LOOP
      base := (p->>'base')::numeric * (0.92 + random() * 0.16); -- ±8% por estado
      price := base;
      prev := base;

      -- gera 60 dias de histórico (random walk)
      FOR i IN REVERSE 59..0 LOOP
        d := CURRENT_DATE - i;
        price := GREATEST(0.01, price * (1 + (random() - 0.5) * 0.025));
        INSERT INTO public.market_price_history (product, state, price, reference_date)
        VALUES (p->>'name', s->>'uf', ROUND(price::numeric, 2), d)
        ON CONFLICT DO NOTHING;
      END LOOP;

      -- variações
      INSERT INTO public.market_prices_states
        (product, state, region, unit, price, variation_day, variation_week, source, reference_date)
      VALUES (
        p->>'name', s->>'uf', s->>'region', p->>'unit',
        ROUND(price::numeric, 2),
        ROUND(((random() - 0.5) * 4)::numeric, 2),
        ROUND(((random() - 0.5) * 8)::numeric, 2),
        'Simulado',
        CURRENT_DATE
      );
    END LOOP;
  END LOOP;
END $$;