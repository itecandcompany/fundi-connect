
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS problem_title text,
  ADD COLUMN IF NOT EXISTS problem_description text,
  ADD COLUMN IF NOT EXISTS job_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agreed_price numeric;

CREATE TABLE IF NOT EXISTS public.job_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view messages" ON public.job_messages;
CREATE POLICY "Participants view messages" ON public.job_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_messages.job_id
    AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid()
         OR (j.status IN ('searching','quoting') AND has_role(auth.uid(),'fundi')))));

DROP POLICY IF EXISTS "Participants send messages" ON public.job_messages;
CREATE POLICY "Participants send messages" ON public.job_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_messages.job_id
    AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid()
         OR (j.status IN ('searching','quoting') AND has_role(auth.uid(),'fundi')))));

CREATE INDEX IF NOT EXISTS job_messages_job_idx ON public.job_messages(job_id, created_at);

CREATE TABLE IF NOT EXISTS public.job_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  fundi_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, fundi_id)
);
ALTER TABLE public.job_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quote visibility" ON public.job_quotes;
CREATE POLICY "Quote visibility" ON public.job_quotes
  FOR SELECT TO authenticated
  USING (auth.uid() = fundi_id OR EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_quotes.job_id AND j.client_id = auth.uid()));

DROP POLICY IF EXISTS "Fundi creates quote" ON public.job_quotes;
CREATE POLICY "Fundi creates quote" ON public.job_quotes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = fundi_id AND has_role(auth.uid(),'fundi')
    AND EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_quotes.job_id
      AND j.status IN ('searching','quoting')));

DROP POLICY IF EXISTS "Quote owner or client updates" ON public.job_quotes;
CREATE POLICY "Quote owner or client updates" ON public.job_quotes
  FOR UPDATE TO authenticated
  USING (auth.uid() = fundi_id OR EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = job_quotes.job_id AND j.client_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.problem_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service service_type NOT NULL,
  title text NOT NULL,
  description text,
  suggested_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.problem_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated views templates" ON public.problem_templates;
CREATE POLICY "Anyone authenticated views templates" ON public.problem_templates
  FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage templates" ON public.problem_templates;
CREATE POLICY "Admins manage templates" ON public.problem_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos','job-photos', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Job photos are public readable" ON storage.objects;
CREATE POLICY "Job photos are public readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-photos');

DROP POLICY IF EXISTS "Authenticated upload own job photos" ON storage.objects;
CREATE POLICY "Authenticated upload own job photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners delete own job photos" ON storage.objects;
CREATE POLICY "Owners delete own job photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'job-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.on_job_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amt numeric;
  com numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.fundi_id IS NOT NULL THEN
    amt := COALESCE(NEW.agreed_price, NEW.price, 0);
    com := ROUND(amt * 0.10);
    INSERT INTO public.transactions (job_id, fundi_id, amount, commission, fundi_earnings)
      VALUES (NEW.id, NEW.fundi_id, amt, com, amt - com);
    UPDATE public.fundis SET total_jobs = total_jobs + 1 WHERE id = NEW.fundi_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_on_job_completed ON public.jobs;
CREATE TRIGGER trg_on_job_completed AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.on_job_completed();

ALTER PUBLICATION supabase_realtime ADD TABLE public.job_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_quotes;

INSERT INTO public.problem_templates (service, title, description, suggested_price) VALUES
  ('plumber','Leaking pipe','Small leak under sink or wall fixture', 25000),
  ('plumber','Clogged drain','Slow or blocked drain in kitchen/bath', 30000),
  ('plumber','Toilet repair','Running, blocked or broken toilet', 35000),
  ('electrician','Power outage in room','One area has no power', 30000),
  ('electrician','Faulty socket','Socket sparking or not working', 25000),
  ('electrician','Light fixture install','Install or replace ceiling light', 40000),
  ('carpenter','Door not closing','Door alignment / hinges', 20000),
  ('carpenter','Furniture repair','Broken chair, table, or cabinet', 25000),
  ('mechanic','Won''t start','Engine cranking / battery / starter', 50000),
  ('mechanic','Flat tyre','Replace or patch tyre', 20000)
ON CONFLICT DO NOTHING;
