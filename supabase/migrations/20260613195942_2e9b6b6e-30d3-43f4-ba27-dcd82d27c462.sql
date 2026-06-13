DROP POLICY IF EXISTS "Job participants receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Assigned fundi sends location broadcasts" ON realtime.messages;

CREATE POLICY "Job participants receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE realtime.topic() = 'job:' || j.id::text
      AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid())
  )
);

CREATE POLICY "Assigned fundi sends location broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE realtime.topic() = 'job:' || j.id::text
      AND j.fundi_id = auth.uid()
      AND j.status IN ('accepted', 'on_the_way', 'arrived', 'in_progress')
  )
);