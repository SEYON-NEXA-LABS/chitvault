-- PERMANENT PROFILE SECURITY NORMALIZATION (RECURSION-PROOF)
-- This version uses the "Security Definer" function pattern to 100% guarantee no recursion.

-- 1. Create a "Safe" Lookup Function
-- This function runs with "Master" privileges (SECURITY DEFINER)
-- so it can look up your firm_id without triggering RLS recursion.
CREATE OR REPLACE FUNCTION public.get_auth_firm_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT firm_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop View (from previous attempt) and Policies
DROP VIEW IF EXISTS public.profiles_security_helper;

DROP POLICY IF EXISTS "profiles_master_emergency" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_row" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_firm_members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_firm" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_super" ON public.profiles;

-- 3. Permanent High-Performance Policies

-- Policy: Users can always see their own row
CREATE POLICY "profiles_select_self" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- Policy: Owners and Staff can see others in their firm
CREATE POLICY "profiles_select_firm" ON public.profiles
FOR SELECT USING (
  firm_id = public.get_auth_firm_id()
);

-- Policy: Superadmins can see everything
CREATE POLICY "profiles_select_super" ON public.profiles
FOR SELECT USING (
  public.get_auth_role() = 'superadmin'
);

-- 4. Firms Table Normalization
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firms_select_member" ON public.firms;

CREATE POLICY "firms_select_member" ON public.firms
FOR SELECT USING (
  id = public.get_auth_firm_id()
);
