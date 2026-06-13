DROP POLICY IF EXISTS "Participants view messages" ON public.job_messages;
CREATE POLICY "Participants view messages"
ON public.job_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

DROP POLICY IF EXISTS "Quote owner or client updates" ON public.job_quotes;
CREATE POLICY "Quote owner or client updates"
ON public.job_quotes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_quotes.job_id
      AND (
        (job_quotes.fundi_id = auth.uid() AND j.status IN ('searching'::public.job_status, 'quoting'::public.job_status))
        OR j.client_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_quotes.job_id
      AND (
        (job_quotes.fundi_id = auth.uid() AND j.status IN ('searching'::public.job_status, 'quoting'::public.job_status))
        OR j.client_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Authorized users can view fundis" ON public.fundis;
CREATE POLICY "Authorized users can view fundis"
ON public.fundis
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.fundi_id = fundis.id
      AND j.client_id = auth.uid()
      AND j.status NOT IN ('completed'::public.job_status, 'cancelled'::public.job_status)
  )
);