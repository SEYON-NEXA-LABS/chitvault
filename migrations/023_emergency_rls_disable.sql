-- EMERGENCY SLEDGEHAMMER RESET
-- This script disables RLS and removes ALL security-related objects 
-- to recover from a systemic "Access Denied" or 500 error collapse.

-- 1. DISABLE RLS (Restore public visibility temporarily)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- 2. WIPE ALL POLICIES (Cleaning up generic integrity-page policies)
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' 
              AND tablename IN ('profiles', 'firms', 'groups', 'members', 'auctions', 'payments')) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON "public"."' || r.tablename || '"';
    END LOOP;
END $$;

-- 3. REMOVE RECENT TRIGGERS & FUNCTIONS
DROP TRIGGER IF EXISTS on_profile_sync ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_user_metadata();
DROP FUNCTION IF EXISTS public.get_auth_firm_id();
DROP FUNCTION IF EXISTS public.get_auth_role();
DROP VIEW IF EXISTS public.profiles_security_helper;
