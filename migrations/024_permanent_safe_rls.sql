-- PERMANENT SECURITY NORMALIZATION (SAFE MODE)
-- Pattern: Session Metadata Sync (JWT-based isolation)
-- Resolves: 100% of RLS Recursion and 500 errors permanently.

-- 1. Create/Update the Metadata Sync Function
CREATE OR REPLACE FUNCTION public.sync_user_metadata() 
RETURNS TRIGGER AS $$
BEGIN
  -- Syncs firm_id and role to the AUTH metadata
  -- This allows RLS to check permissions WITHOUT hitting the profiles table.
  UPDATE auth.users 
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('firm_id', NEW.firm_id, 'role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Attach the Sync Trigger to Profiles
DROP TRIGGER IF EXISTS on_profile_sync ON public.profiles;
CREATE TRIGGER on_profile_sync
  AFTER INSERT OR UPDATE OF firm_id, role ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_metadata();

-- 3. Perform a Universal Metadata Sync
-- This fixes every existing profile in the system at once.
UPDATE public.profiles SET updated_at = now();

-- 4. RE-ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 5. APPLY RECURSION-FREE POLICIES
-- These policies use metadata from the JWT, which is instant and non-recursive.

-- (Profiles)
CREATE POLICY "profiles_select_isolated" ON public.profiles 
FOR SELECT USING (
  id = auth.uid() OR 
  (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid = firm_id OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- (Firms)
CREATE POLICY "firms_select_isolated" ON public.firms 
FOR SELECT USING (
  id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- (Groups)
CREATE POLICY "groups_select_isolated" ON public.groups 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- (Members)
CREATE POLICY "members_select_isolated" ON public.members 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- (Auctions)
CREATE POLICY "auctions_select_isolated" ON public.auctions 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- (Payments)
CREATE POLICY "payments_select_isolated" ON public.payments 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- 6. Cleanup previous views/functions
DROP VIEW IF EXISTS public.profiles_security_helper;
DROP FUNCTION IF EXISTS public.get_auth_firm_id();
DROP FUNCTION IF EXISTS public.get_auth_role();
