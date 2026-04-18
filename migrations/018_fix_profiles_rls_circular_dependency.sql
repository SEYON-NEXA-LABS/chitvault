-- Fix RLS policy for profiles to prevent circular dependency during login
-- This ensures that a user can always select their own profile row 
-- without needing to successfully run my_firm_id() first.

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles 
FOR SELECT USING (
  id = auth.uid() 
  OR is_superadmin() 
  OR firm_id = my_firm_id()
);

-- Note: id = auth.uid() is evaluated first, which allows the initial 
-- profile fetch to succeed immediately after login.
