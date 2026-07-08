-- Wire admin guard via SECURITY DEFINER helper so app code can assert admin without leaking role table
CREATE OR REPLACE FUNCTION public.assert_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin(uuid) TO service_role;
