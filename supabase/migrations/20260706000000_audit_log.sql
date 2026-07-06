CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  delta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads audit_log" ON public.audit_log;
CREATE POLICY "Admin reads audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role writes audit_log" ON public.audit_log;
CREATE POLICY "Service role writes audit_log"
  ON public.audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;
