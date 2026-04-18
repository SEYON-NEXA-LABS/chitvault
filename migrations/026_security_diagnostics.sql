-- SECURITY INTEGRITY CHECK
-- This RPC allows the frontend to verify if the RLS metadata is correctly synced.

CREATE OR REPLACE FUNCTION public.check_my_security_context()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- RUNS AS THE USER (Honors JWT)
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'uid', auth.uid(),
    'role_in_jwt', auth.jwt() -> 'user_metadata' ->> 'role',
    'firm_id_in_jwt', auth.jwt() -> 'user_metadata' ->> 'firm_id',
    'full_jwt_metadata', auth.jwt() -> 'user_metadata',
    'can_see_own_profile', (SELECT count(*) FROM public.profiles WHERE id = auth.uid())
  );
END;
$$;

grant execute on function public.check_my_security_context() to authenticated;
