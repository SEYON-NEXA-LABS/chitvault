-- Fix RLS Recursion on profiles table
-- High-performance non-recursive policies to prevent 500 errors during login

-- 1. Clean up old policy
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_firm" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_super" ON public.profiles;

-- 2. Create a helper view that bypasses RLS (since it's owned by postgres)
-- This allows us to look up a user's firm/role without triggering the profiles policy loop.
DROP VIEW IF EXISTS public.profiles_security_helper;
CREATE VIEW public.profiles_security_helper WITH (security_invoker = false) AS 
SELECT id, firm_id, role FROM public.profiles;

-- 3. Policy: See Yourself (Zero recursion)
CREATE POLICY "profiles_select_self" ON public.profiles 
FOR SELECT USING (id = auth.uid());

-- 4. Policy: See Firm Members (Using helper view to break recursion)
CREATE POLICY "profiles_select_firm" ON public.profiles 
FOR SELECT USING (
  firm_id = (SELECT h.firm_id FROM public.profiles_security_helper h WHERE h.id = auth.uid() LIMIT 1)
);

-- 5. Policy: Superadmin Access (Using helper view to break recursion)
CREATE POLICY "profiles_select_super" ON public.profiles 
FOR SELECT USING (
  (SELECT h.role FROM public.profiles_security_helper h WHERE h.id = auth.uid() LIMIT 1) = 'superadmin'
);

-- Optimization: Ensure indexes exist for the subqueries
CREATE INDEX IF NOT EXISTS idx_profiles_id_firm_id ON public.profiles(id, firm_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
