-- FINANCIAL SECURITY NORMALIZATION (PART 2)
-- Goal: Unlock visibility for financial calculations and directories
-- Pattern: JWT Metadata Sync (Recursion-Free)

-- 1. Enable RLS on the remaining hidden tables
ALTER TABLE IF EXISTS public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.foreman_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 2. Persons (Contact Directory)
DROP POLICY IF EXISTS "persons_select_isolated" ON public.persons;
CREATE POLICY "persons_select_isolated" ON public.persons 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- 3. Foreman Commissions (Income & Dividends)
DROP POLICY IF EXISTS "commissions_select_isolated" ON public.foreman_commissions;
CREATE POLICY "commissions_select_isolated" ON public.foreman_commissions 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- 4. Settlements (Payout Transparency)
DROP POLICY IF EXISTS "settlements_select_isolated" ON public.settlements;
CREATE POLICY "settlements_select_isolated" ON public.settlements 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- 5. Activity Logs (Audit Trail)
DROP POLICY IF EXISTS "activity_log_select_isolated" ON public.activity_log;
CREATE POLICY "activity_log_select_isolated" ON public.activity_log 
FOR SELECT USING (
  firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- 6. Verification: Force another metadata sync just in case
UPDATE public.profiles SET updated_at = now();
