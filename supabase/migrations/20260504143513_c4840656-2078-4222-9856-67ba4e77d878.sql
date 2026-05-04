DO $$ BEGIN
  CREATE TYPE public.job_direction AS ENUM ('fundi_to_client', 'client_to_fundi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS direction public.job_direction NOT NULL DEFAULT 'fundi_to_client';