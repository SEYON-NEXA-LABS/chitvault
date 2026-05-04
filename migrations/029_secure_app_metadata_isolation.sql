-- MIGRATION: 029_secure_app_metadata_isolation.sql
-- GOAL: Move security context (firm_id, role) from user_metadata (unsafe) to app_metadata (safe).
-- This resolves "SECURITY CRITICAL" warnings in Supabase.

-- 1. Update the Metadata Sync Function
-- This ensures any changes to public.profiles are securely reflected in auth.app_metadata
CREATE OR REPLACE FUNCTION public.sync_user_metadata() 
RETURNS TRIGGER AS $$
BEGIN
  -- 1.1 Sync firm_id and role to the AUTH APP_METADATA (Server-only, secure)
  UPDATE auth.users 
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('firm_id', NEW.firm_id, 'role', NEW.role),
  -- 1.2 Cleanup legacy fields from USER_METADATA (Prevent spoofing)
  raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) - 'firm_id' - 'role'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Migrate existing data for all users
-- This moves values from raw_user_meta_data -> raw_app_meta_data
UPDATE auth.users
SET 
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'firm_id', (raw_user_meta_data->>'firm_id'),
      'role', (raw_user_meta_data->>'role')
    ),
  raw_user_meta_data = raw_user_meta_data - 'firm_id' - 'role'
WHERE raw_user_meta_data ? 'firm_id' OR raw_user_meta_data ? 'role';

-- 3. APPLY SECURE RLS POLICIES TO ALL TABLES
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
        -- 3.1 RESET POLICIES
        FOR r IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = t_table
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t_table);
        END LOOP;

        -- 3.2 APPLY SECURE APP_METADATA ISOLATION
        IF t_table = 'firms' THEN
            EXECUTE format('
                CREATE POLICY "firms_isolation" ON public.firms 
                FOR ALL USING (
                    id = (auth.jwt() -> ''app_metadata'' ->> ''firm_id'')::uuid OR
                    (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
                )');
        ELSIF t_table = 'profiles' THEN
            EXECUTE format('
                CREATE POLICY "profiles_isolation" ON public.profiles 
                FOR ALL USING (
                    id = auth.uid() OR 
                    (auth.jwt() -> ''app_metadata'' ->> ''firm_id'')::uuid = firm_id OR
                    (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
                )');
        ELSE
            -- Standard Firm Isolation for all other tables
            EXECUTE format('
                CREATE POLICY "%I_isolation" ON public.%I 
                FOR ALL USING (
                    firm_id = (auth.jwt() -> ''app_metadata'' ->> ''firm_id'')::uuid OR
                    (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
                )', t_table, t_table);
        END IF;
    END LOOP;
END $$;

-- 4. Final Sync Check
-- Refresh all metadata based on current profile states
UPDATE public.profiles SET updated_at = now();
