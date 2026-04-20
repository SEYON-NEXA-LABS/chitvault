-- FINAL SECURITY POLICY (GUARANTEED ISOLATION)
-- This ensures RLS is active on ALL tables and prevents accidental exposure from past migrations.

DO $$ 
DECLARE
    r RECORD;
    t_table TEXT;
BEGIN
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
        -- 1. FORCE ENABLE RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_table);
        
        -- 2. RESET POLICIES (Unified Security Model)
        FOR r IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = t_table
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t_table);
        END LOOP;

        -- 3. APPLY ISOLATION
        IF t_table = 'firms' THEN
            EXECUTE format('
                CREATE POLICY "firms_isolation" ON public.firms 
                FOR ALL USING (
                    id = (auth.jwt() -> ''user_metadata'' ->> ''firm_id'')::uuid OR
                    (auth.jwt() -> ''user_metadata'' ->> ''role'') = ''superadmin''
                )');
        ELSIF t_table = 'profiles' THEN
            EXECUTE format('
                CREATE POLICY "profiles_isolation" ON public.profiles 
                FOR ALL USING (
                    id = auth.uid() OR 
                    (auth.jwt() -> ''user_metadata'' ->> ''firm_id'')::uuid = firm_id OR
                    (auth.jwt() -> ''user_metadata'' ->> ''role'') = ''superadmin''
                )');
        ELSE
            -- Standard Firm Isolation for all other tables
            EXECUTE format('
                CREATE POLICY "%I_isolation" ON public.%I 
                FOR ALL USING (
                    firm_id = (auth.jwt() -> ''user_metadata'' ->> ''firm_id'')::uuid OR
                    (auth.jwt() -> ''user_metadata'' ->> ''role'') = ''superadmin''
                )', t_table, t_table);
        END IF;
    END LOOP;
END $$;
