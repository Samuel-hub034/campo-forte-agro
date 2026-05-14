ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.animals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.animals;