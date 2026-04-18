-- DEEP SECURITY REPAIR (NUCLEAR OPTION)
-- Goal: Unified, 100% Comprehensive RLS Normalization
-- Pattern: JWT Metadata Sync (Recursion-Free)

DO $$ 
DECLARE
    r RECORD;
    t_table TEXT;
BEGIN
    -- 1. IDENTIFY ALL RELEVANT TABLES
    -- We target every table that should be multi-tenant or profile-aware.
    FOR t_table IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'firms', 'profiles', 'groups', 'members', 'persons', 
            'auctions', 'payments', 'foreman_commissions', 'settlements', 
            'activity_logs', 'invites', 'denominations', 'cashbook', 'schemes'
          )
    LOOP
        -- a. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_table);
        
        -- b. Wipe existing policies to prevent conflicts
        FOR r IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = t_table
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t_table);
        END LOOP;

        -- c. Apply the Universal Isolation Policy
        -- Exception 1: Firms table checks its own ID
        -- Exception 2: Profiles table check self-ID or firm_id
        IF t_table = 'firms' THEN
            EXECUTE format('
                CREATE POLICY "firms_universal_isolation" ON public.firms 
                FOR SELECT USING (
                    id = (auth.jwt() -> ''user_metadata'' ->> ''firm_id'')::uuid OR
                    (auth.jwt() -> ''user_metadata'' ->> ''role'') = ''superadmin''
                )');
        ELSIF t_table = 'profiles' THEN
            EXECUTE format('
                CREATE POLICY "profiles_universal_isolation" ON public.profiles 
                FOR SELECT USING (
                    id = auth.uid() OR 
                    (auth.jwt() -> ''user_metadata'' ->> ''firm_id'')::uuid = firm_id OR
                    (auth.jwt() -> ''user_metadata'' ->> ''role'') = ''superadmin''
                )');
        ELSE
            -- Standard Firm Isolation
            EXECUTE format('
                CREATE POLICY "%I_universal_isolation" ON public.%I 
                FOR SELECT USING (
                    firm_id = (auth.jwt() -> ''user_metadata'' ->> ''firm_id'')::uuid OR
                    (auth.jwt() -> ''user_metadata'' ->> ''role'') = ''superadmin''
                )', t_table, t_table);
        END IF;
    END LOOP;
END $$;

-- 2. UNIVERSAL METADATA SYNC (The "Wake Up" Trigger)
-- This forces every profile to re-sync its metadata to auth.users immediately.
UPDATE public.profiles SET updated_at = now();

-- 3. VERIFY RPC ACCESS
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
