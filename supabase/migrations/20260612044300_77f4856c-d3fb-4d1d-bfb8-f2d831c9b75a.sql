
-- =========================================================
-- 1) Hide precise client location from unassigned fundis
-- =========================================================
DROP POLICY IF EXISTS "Clients see own jobs; fundis see assigned or open matching" ON public.jobs;

CREATE POLICY "Clients see own jobs"
ON public.jobs FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Assigned fundi sees job"
ON public.jobs FOR SELECT
USING (fundi_id IS NOT NULL AND auth.uid() = fundi_id);

CREATE POLICY "Admins see all jobs"
ON public.jobs FOR SELECT
USING (public.has_role(auth.uid(),'admin'::app_role));

-- Function exposing open jobs to fundis with rounded coords and no address
CREATE OR REPLACE FUNCTION public.list_open_jobs_for_fundi()
RETURNS TABLE (
  id uuid,
  client_id uuid,
  fundi_id uuid,
  service text,
  status text,
  client_lat double precision,
  client_lng double precision,
  price numeric,
  agreed_price numeric,
  problem_title text,
  problem_description text,
  job_photos text[],
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_service text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'fundi'::app_role) THEN
    RETURN;
  END IF;
  SELECT f.service::text INTO me_service FROM public.fundis f WHERE f.id = auth.uid();
  IF me_service IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    j.id, j.client_id, j.fundi_id, j.service::text, j.status::text,
    -- Round to ~1km grid so precise home address is hidden
    round(j.client_lat::numeric, 2)::double precision AS client_lat,
    round(j.client_lng::numeric, 2)::double precision AS client_lng,
    j.price, j.agreed_price,
    j.problem_title, j.problem_description, j.job_photos, j.created_at
  FROM public.jobs j
  WHERE j.status IN ('searching','quoting')
    AND j.service::text = me_service
  ORDER BY j.created_at DESC
  LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.list_open_jobs_for_fundi() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_jobs_for_fundi() TO authenticated;

-- =========================================================
-- 2) Auto-promote job to 'quoting' via trigger so fundis don't need UPDATE on jobs
-- =========================================================
CREATE OR REPLACE FUNCTION public.bump_job_to_quoting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs
     SET status = 'quoting'
   WHERE id = NEW.job_id AND status = 'searching';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_job_to_quoting() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bump_job_to_quoting_trg ON public.job_quotes;
CREATE TRIGGER bump_job_to_quoting_trg
AFTER INSERT ON public.job_quotes
FOR EACH ROW EXECUTE FUNCTION public.bump_job_to_quoting();

-- =========================================================
-- 3) Prevent users from self-assigning roles
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;
-- No INSERT/UPDATE/DELETE policies for normal users.
-- The handle_new_user() SECURITY DEFINER trigger keeps signups working.
-- Admins can manage via service role.

-- =========================================================
-- 4) Restrict realtime.messages to authenticated users
-- =========================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (true);
