REVOKE ALL ON FUNCTION public.list_open_jobs_for_fundi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_jobs_for_fundi() TO service_role;