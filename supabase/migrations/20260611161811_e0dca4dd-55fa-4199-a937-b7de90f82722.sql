ALTER TABLE public.job_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS job_messages_job_id_created_at_idx ON public.job_messages(job_id, created_at);

-- Allow recipient to update read_at on messages they didn't send (and only that column-effect)
DROP POLICY IF EXISTS "Recipient can mark message read" ON public.job_messages;
CREATE POLICY "Recipient can mark message read"
ON public.job_messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_messages.job_id
      AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
  )
);