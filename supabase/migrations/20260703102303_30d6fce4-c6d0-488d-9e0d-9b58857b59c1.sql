
-- 1) Tighten fundis SELECT: clients can only see fundi row (incl GPS) after job is accepted
DROP POLICY IF EXISTS "Authorized users can view fundis" ON public.fundis;
CREATE POLICY "Authorized users can view fundis"
ON public.fundis
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.fundi_id = fundis.id
      AND j.client_id = auth.uid()
      AND j.status IN ('accepted','on_the_way','arrived','in_progress')
  )
);

-- 2) Restrict job-photos INSERT to require job membership when 2nd path segment is a job id
DROP POLICY IF EXISTS "Authenticated upload own job photos" ON storage.objects;
CREATE POLICY "Authenticated upload own job photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    -- Either no job-scoped subfolder (pre-job uploads under <uid>/...)
    (storage.foldername(name))[2] IS NULL
    -- Or the second segment isn't a UUID (free-form)
    OR (storage.foldername(name))[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    -- Or the uploader is a participant of that job
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[2]
        AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
    )
  )
);
