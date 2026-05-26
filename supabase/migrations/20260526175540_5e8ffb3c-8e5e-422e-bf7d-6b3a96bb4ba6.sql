
-- Extend animals with sex, genealogy, mortality
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('macho','femea')),
  ADD COLUMN IF NOT EXISTS mother_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS father_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS death_date date,
  ADD COLUMN IF NOT EXISTS death_reason text;

-- Timeline / events table (polymorphic): pesagem, vacina, doenca, medicamento, reproducao, mortalidade, observacao
CREATE TABLE IF NOT EXISTS public.animal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  animal_id uuid NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('pesagem','vacina','doenca','medicamento','reproducao','mortalidade','observacao')),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost numeric DEFAULT 0,
  next_due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_animal_events_animal ON public.animal_events(animal_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_animal_events_user_type ON public.animal_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_animal_events_next_due ON public.animal_events(user_id, next_due_date) WHERE next_due_date IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.animal_events TO authenticated;
GRANT ALL ON public.animal_events TO service_role;

ALTER TABLE public.animal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select animal_events" ON public.animal_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert animal_events" ON public.animal_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update animal_events" ON public.animal_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner delete animal_events" ON public.animal_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins view all animal_events" ON public.animal_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: when event_type='pesagem' with data.weight_kg, update animals.weight_kg to latest
CREATE OR REPLACE FUNCTION public.sync_animal_weight()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w numeric;
BEGIN
  IF NEW.event_type = 'pesagem' AND NEW.data ? 'weight_kg' THEN
    w := (NEW.data->>'weight_kg')::numeric;
    IF w IS NOT NULL AND w > 0 THEN
      UPDATE public.animals
      SET weight_kg = w, updated_at = now()
      WHERE id = NEW.animal_id
        AND user_id = NEW.user_id
        AND (
          updated_at IS NULL
          OR NEW.event_date >= COALESCE((
            SELECT MAX(event_date) FROM public.animal_events
            WHERE animal_id = NEW.animal_id AND event_type='pesagem' AND id <> NEW.id
          ), '1900-01-01'::date)
        );
    END IF;
  END IF;

  IF NEW.event_type = 'mortalidade' THEN
    UPDATE public.animals
    SET status = 'morto',
        death_date = COALESCE(NEW.event_date, CURRENT_DATE),
        death_reason = COALESCE(NEW.description, NEW.title),
        updated_at = now()
    WHERE id = NEW.animal_id AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_animal_weight ON public.animal_events;
CREATE TRIGGER trg_sync_animal_weight
AFTER INSERT ON public.animal_events
FOR EACH ROW EXECUTE FUNCTION public.sync_animal_weight();
