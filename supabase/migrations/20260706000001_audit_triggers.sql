CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log (actor_user_id, action, target_table, target_id, delta)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'job_status_change',
      'jobs',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_job_status_change ON public.jobs;
CREATE TRIGGER trg_log_job_status_change
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_job_status_change();

CREATE OR REPLACE FUNCTION public.log_admin_job_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    INSERT INTO public.audit_log (actor_user_id, action, target_table, target_id, delta)
    VALUES (
      auth.uid(),
      'admin_job_update',
      'jobs',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_cancelled', OLD.cancelled_at,
        'new_cancelled', NEW.cancelled_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_admin_job_update ON public.jobs;
CREATE TRIGGER trg_log_admin_job_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_job_update();

CREATE OR REPLACE FUNCTION public.log_problem_template_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_user_id, action, target_table, target_id, delta)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    CASE TG_OP WHEN 'INSERT' THEN 'template_create' WHEN 'UPDATE' THEN 'template_update' ELSE 'template_delete' END,
    'problem_templates',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('op', TG_OP)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_problem_template_change ON public.problem_templates;
CREATE TRIGGER trg_log_problem_template_change
  AFTER INSERT OR UPDATE OR DELETE ON public.problem_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_problem_template_change();

REVOKE ALL ON FUNCTION public.log_job_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_admin_job_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_problem_template_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_job_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_job_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_problem_template_change() TO service_role;
