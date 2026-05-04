ALTER TABLE public.job_locations REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;