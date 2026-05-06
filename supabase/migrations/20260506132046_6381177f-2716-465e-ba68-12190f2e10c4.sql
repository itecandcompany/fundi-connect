
REVOKE EXECUTE ON FUNCTION public.on_job_completed() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Job photos are public readable" ON storage.objects;
CREATE POLICY "Job photos readable by id only" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] IS NOT NULL);
