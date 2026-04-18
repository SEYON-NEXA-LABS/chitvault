-- FAILSAFE PROFILE RESET
-- This script removes all complexity and recursion to ensure you can log in.

-- 1. Reset all Select Policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_firm" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_super" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_basic" ON public.profiles;

-- 2. CREATE THE SIMPLEST POLICY POSSIBLE
-- A user can ALWAYS see their own row.
-- This has NO subqueries and NO functions. It CANNOT recurse.
CREATE POLICY "profiles_select_own_row" ON public.profiles 
FOR SELECT USING (id = auth.uid());

-- 3. ALLOW OWNERS TO SEE THEIR STAFF (Non-recursive version)
-- We check if the row being selected belongs to the SAME firm as the one
-- we are looking for, but we use a direct comparison.
-- To avoid recursion, we'll only re-enable this after your login works.
-- For now, we add a policy that allows owners to see everything in their firm
-- BUT we use the my_firm_id() function which we will also fix.

CREATE OR REPLACE FUNCTION public.get_my_firm_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- This select bypasses RLS because it's SECURITY DEFINER and owned by postgres
  SELECT firm_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "profiles_select_firm_members" ON public.profiles 
FOR SELECT USING (firm_id = public.get_my_firm_id());

-- 4. FINAL SAFETY: Ensure RLS is active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
