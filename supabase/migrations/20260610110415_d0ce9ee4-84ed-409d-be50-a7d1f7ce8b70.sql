
-- Storage policy (file-level)
DROP POLICY IF EXISTS "Job photos readable by id only" ON storage.objects;
CREATE POLICY "Job photos readable by participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE (storage.foldername(name))[2] IS NOT NULL
        AND j.id::text = (storage.foldername(name))[2]
        AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
    )
  )
);

-- Profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by self admin or counterparty"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE (j.client_id = auth.uid() AND j.fundi_id = profiles.id)
       OR (j.fundi_id = auth.uid() AND j.client_id = profiles.id)
  )
);

-- Ratings
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Ratings viewable by participants"
ON public.ratings
FOR SELECT
TO authenticated
USING (
  client_id = auth.uid()
  OR fundi_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
