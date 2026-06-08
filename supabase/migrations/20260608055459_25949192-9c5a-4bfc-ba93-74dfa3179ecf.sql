ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS before_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS after_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signature_url text;