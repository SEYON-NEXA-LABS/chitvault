-- SAFE FINANCIAL SECURITY NORMALIZATION
-- Only applies policies if the tables actually exist in the database.

DO $$ 
BEGIN
    -- 1. Unlocking Persons (Name Directory)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'persons') THEN
        ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "persons_select_isolated" ON public.persons;
        CREATE POLICY "persons_select_isolated" ON public.persons 
        FOR SELECT USING (
          firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
          (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
        );
    END IF;

    -- 2. Unlocking Foreman Commissions (Income & Dividends)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'foreman_commissions') THEN
        ALTER TABLE public.foreman_commissions ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "commissions_select_isolated" ON public.foreman_commissions;
        CREATE POLICY "commissions_select_isolated" ON public.foreman_commissions 
        FOR SELECT USING (
          firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
          (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
        );
    END IF;

    -- 3. Unlocking Settlements (Payout History)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlements') THEN
        ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "settlements_select_isolated" ON public.settlements;
        CREATE POLICY "settlements_select_isolated" ON public.settlements 
        FOR SELECT USING (
          firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
          (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
        );
    END IF;

    -- 4. Unlocking Activity Logs (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
        ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "activity_log_select_isolated" ON public.activity_logs;
        CREATE POLICY "activity_log_select_isolated" ON public.activity_logs 
        FOR SELECT USING (
          firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
          (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
        );
    END IF;

END $$;

-- Force metadata sync
UPDATE public.profiles SET updated_at = now();
