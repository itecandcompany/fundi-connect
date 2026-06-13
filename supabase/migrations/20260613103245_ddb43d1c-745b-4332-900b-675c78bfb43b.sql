CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  _role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'fundi' THEN 'fundi'::public.app_role
    ELSE 'client'::public.app_role
  END;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    _role
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP POLICY IF EXISTS "Client rates own completed jobs" ON public.ratings;
CREATE POLICY "Client rates own completed jobs"
ON public.ratings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = client_id
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = ratings.job_id
      AND j.client_id = auth.uid()
      AND j.fundi_id = ratings.fundi_id
      AND j.status = 'completed'::public.job_status
  )
);

DROP POLICY IF EXISTS "Anyone authenticated can view fundis" ON public.fundis;
CREATE POLICY "Authorized users can view fundis"
ON public.fundis
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'client'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admin updates jobs" ON public.jobs;
CREATE POLICY "Admin updates jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins see all jobs" ON public.jobs;
CREATE POLICY "Admins see all jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Assigned fundi sees job" ON public.jobs;
CREATE POLICY "Assigned fundi sees job"
ON public.jobs
FOR SELECT
TO authenticated
USING (fundi_id IS NOT NULL AND auth.uid() = fundi_id);

DROP POLICY IF EXISTS "Assigned fundi updates job" ON public.jobs;
CREATE POLICY "Assigned fundi updates job"
ON public.jobs
FOR UPDATE
TO authenticated
USING (fundi_id IS NOT NULL AND auth.uid() = fundi_id)
WITH CHECK (fundi_id IS NOT NULL AND auth.uid() = fundi_id);

DROP POLICY IF EXISTS "Client updates own job" ON public.jobs;
CREATE POLICY "Client updates own job"
ON public.jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients see own jobs" ON public.jobs;
CREATE POLICY "Clients see own jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Participants send messages" ON public.job_messages;
CREATE POLICY "Participants send messages"
ON public.job_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (
        j.client_id = auth.uid()
        OR j.fundi_id = auth.uid()
        OR (
          j.status IN ('searching'::public.job_status, 'quoting'::public.job_status)
          AND public.has_role(auth.uid(), 'fundi'::public.app_role)
        )
      )
  )
);

DROP POLICY IF EXISTS "Participants view messages" ON public.job_messages;
CREATE POLICY "Participants view messages"
ON public.job_messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Owners update own job photos" ON storage.objects;
CREATE POLICY "Owners update own job photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;

REVOKE ALL ON FUNCTION public.list_open_jobs_for_fundi() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_jobs_for_fundi() TO authenticated, service_role;