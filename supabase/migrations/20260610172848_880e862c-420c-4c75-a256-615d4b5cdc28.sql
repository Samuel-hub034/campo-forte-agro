
ALTER TABLE public.animal_events DROP CONSTRAINT IF EXISTS animal_events_event_type_check;
ALTER TABLE public.animal_events ADD CONSTRAINT animal_events_event_type_check
  CHECK (event_type = ANY (ARRAY['pesagem'::text,'vacina'::text,'doenca'::text,'medicamento'::text,'reproducao'::text,'mortalidade'::text,'observacao'::text,'venda'::text,'cadastro'::text]));

CREATE OR REPLACE FUNCTION public.sync_animal_weight()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NEW.event_type = 'venda' THEN
    UPDATE public.animals
    SET status = 'vendido',
        updated_at = now()
    WHERE id = NEW.animal_id AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;
