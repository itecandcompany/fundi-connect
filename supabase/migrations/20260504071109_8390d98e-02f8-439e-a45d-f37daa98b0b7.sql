ALTER TABLE public.fundis REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fundis;