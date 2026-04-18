-- ChitVault — System Integrity Diagnostic Functions
-- Ported and adapted from PledgeVault

-- 1. Schema Column Fetcher (for external verification script)
CREATE OR REPLACE FUNCTION get_schema_metadata()
RETURNS TABLE (
  table_name TEXT,
  column_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.table_name::TEXT, 
    c.column_name::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  AND c.table_name NOT IN ('pg_stat_user_tables', 'pg_statio_user_tables')
  AND c.table_name !~ '^pg_' -- Exclude internal pg tables
  AND c.table_name !~ '^sql_'; -- Exclude internal sql tables
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. System Integrity Diagnostic Function
CREATE OR REPLACE FUNCTION check_db_integrity()
RETURNS JSON AS $$
DECLARE
  tables_status JSON;
  columns_status JSON;
  functions_status JSON;
  rls_status JSON;
  result JSON;
BEGIN
  -- Only allowed for superadmins
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Superadmin access required';
  END IF;

  -- Check Tables
  tables_status := (
    SELECT json_agg(json_build_object('table_name', table_name, 'exists', true))
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('firms', 'profiles', 'persons', 'groups', 'members', 'auctions', 'payments', 'cashbook', 'reports')
  );

  -- Check Critical Columns (Platform specific logic)
  columns_status := (
    SELECT json_agg(json_build_object('table_name', table_name, 'column_name', column_name, 'exists', true))
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (
      (table_name = 'firms' AND column_name = 'slug') OR
      (table_name = 'profiles' AND column_name = 'firm_id') OR
      (table_name = 'groups' AND column_name = 'auction_scheme') OR
      (table_name = 'members' AND column_name = 'ticket_no') OR
      (table_name = 'auctions' AND column_name = 'winner_id') OR
      (table_name = 'payments' AND column_name = 'amount')
    )
  );

  -- Check Security (RLS)
  rls_status := (
    SELECT json_agg(json_build_object('table_name', tablename, 'rls_enabled', rowsecurity))
    FROM pg_tables
    JOIN pg_class ON pg_tables.tablename = pg_class.relname
    WHERE schemaname = 'public'
    AND tablename IN ('firms', 'profiles', 'groups', 'members', 'auctions', 'payments')
  );

  -- Check Critical Functions
  functions_status := (
    SELECT json_agg(json_build_object('function_name', routine_name, 'exists', true))
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
      'record_user_usage', 
      'get_firm_branding', 
      'admin_create_firm', 
      'check_db_integrity',
      'get_firm_dashboard_stats'
    )
  );

  result := (
    SELECT json_build_object(
      'tables', COALESCE(tables_status, '[]'::json),
      'columns', COALESCE(columns_status, '[]'::json),
      'security', COALESCE(rls_status, '[]'::json),
      'functions', COALESCE(functions_status, '[]'::json),
      'timestamp', now()
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
