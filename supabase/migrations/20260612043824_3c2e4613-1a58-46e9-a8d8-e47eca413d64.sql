
CREATE OR REPLACE FUNCTION public.guard_jobs_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.client_id THEN
    IF OLD.fundi_id IS NOT NULL AND NEW.fundi_id IS NOT NULL AND OLD.fundi_id <> NEW.fundi_id THEN
      RAISE EXCEPTION 'Cannot reassign fundi directly';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.fundi_id IS NOT NULL AND auth.uid() = OLD.fundi_id THEN
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

REVOKE ALL ON FUNCTION public.guard_jobs_update() FROM PUBLIC, anon, authenticated;
