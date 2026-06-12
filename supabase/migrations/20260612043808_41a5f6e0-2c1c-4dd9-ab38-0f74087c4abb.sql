
-- Fix 1: job_messages SELECT - prevent fundi cross-leak
DROP POLICY IF EXISTS "Participants view messages" ON public.job_messages;
CREATE POLICY "Participants view messages"
ON public.job_messages FOR SELECT
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 1b: tighten INSERT - sender must be client, assigned fundi, or fundi sending into a searching/quoting job (their own message)
DROP POLICY IF EXISTS "Participants send messages" ON public.job_messages;
CREATE POLICY "Participants send messages"
ON public.job_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (
        j.client_id = auth.uid()
        OR j.fundi_id = auth.uid()
        OR (j.status IN ('searching','quoting') AND public.has_role(auth.uid(), 'fundi'::app_role))
      )
  )
);

-- Fix 2: jobs UPDATE - split client vs fundi, prevent column abuse via trigger
DROP POLICY IF EXISTS "Client or assigned fundi update" ON public.jobs;

CREATE POLICY "Client updates own job"
ON public.jobs FOR UPDATE
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Assigned fundi updates job"
ON public.jobs FOR UPDATE
USING (fundi_id IS NOT NULL AND auth.uid() = fundi_id)
WITH CHECK (fundi_id IS NOT NULL AND auth.uid() = fundi_id);

CREATE POLICY "Admin updates jobs"
ON public.jobs FOR UPDATE
USING (public.has_role(auth.uid(),'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Trigger to prevent fundis from mutating sensitive columns
CREATE OR REPLACE FUNCTION public.guard_jobs_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- If the caller is the client, allow but lock fundi-only operational fields from being abused
  IF auth.uid() = OLD.client_id THEN
    -- Client may not change fundi_id from one fundi to a different fundi directly except via accept flow
    -- Allow setting fundi_id from NULL to a value (acceptance) and clearing it back to NULL (cancel)
    IF OLD.fundi_id IS NOT NULL AND NEW.fundi_id IS NOT NULL AND OLD.fundi_id <> NEW.fundi_id THEN
      RAISE EXCEPTION 'Cannot reassign fundi directly';
    END IF;
    RETURN NEW;
  END IF;
  -- Otherwise the caller must be the assigned fundi
  IF OLD.fundi_id IS NOT NULL AND auth.uid() = OLD.fundi_id THEN
    -- Fundis cannot change pricing, ownership, or self-assignment fields
    IF NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.fundi_id IS DISTINCT FROM OLD.fundi_id
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.agreed_price IS DISTINCT FROM OLD.agreed_price
       OR NEW.commission IS DISTINCT FROM OLD.commission THEN
      RAISE EXCEPTION 'Fundi cannot modify protected job fields';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Not authorized to update job';
END;
$$;

DROP TRIGGER IF EXISTS guard_jobs_update_trg ON public.jobs;
CREATE TRIGGER guard_jobs_update_trg
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_jobs_update();

-- Fix 3: storage UPDATE policy for job-photos scoped to owner folder
DROP POLICY IF EXISTS "Owners update own job photos" ON storage.objects;
CREATE POLICY "Owners update own job photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
