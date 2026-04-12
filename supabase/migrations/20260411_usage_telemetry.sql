-- 1. Add billing_start_day to firms if not exists
ALTER TABLE firms ADD COLUMN IF NOT EXISTS billing_start_day int DEFAULT 1;

-- 2. Telemetry Storage Table (Expanded for Full Doc Fidelity)
CREATE TABLE IF NOT EXISTS user_usage_telemetry (
    id                    bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    firm_id               uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    user_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    metric_date           date DEFAULT current_date,
    
    -- Egress Categories (Bytes)
    db_egress_bytes       bigint DEFAULT 0,
    api_traffic_bytes     bigint DEFAULT 0,
    realtime_egress_bytes bigint DEFAULT 0,
    edge_func_egress_bytes bigint DEFAULT 0,
    
    -- Count Categories
    ops_count             int DEFAULT 0,
    auth_requests         int DEFAULT 0,
    emails_sent           int DEFAULT 0,
    
    UNIQUE(firm_id, user_id, metric_date)
);

-- Indexing for high-performance aggregation
CREATE INDEX IF NOT EXISTS idx_usage_telemetry_firm     ON user_usage_telemetry(firm_id);
CREATE INDEX IF NOT EXISTS idx_usage_telemetry_date     ON user_usage_telemetry(metric_date);

-- 3. RPC: Record Usage (Heartbeat/Middleware)
-- Drop old signatures to avoid "function does not exist" or "ambiguous" errors
DROP FUNCTION IF EXISTS public.record_user_usage(uuid, uuid, bigint, boolean);
DROP FUNCTION IF EXISTS public.record_user_usage(uuid, uuid, bigint, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.record_user_usage(
  p_firm_id uuid,
  p_user_id uuid,
  p_egress_bytes bigint DEFAULT 0,
  p_is_auth boolean DEFAULT false,
  p_is_realtime boolean DEFAULT false,
  p_is_email boolean DEFAULT false
) RETURNS void AS $$
BEGIN
    INSERT INTO public.user_usage_telemetry (
      firm_id, user_id, 
      db_egress_bytes, 
      realtime_egress_bytes,
      auth_requests, 
      emails_sent,
      ops_count
    )
    VALUES (
      p_firm_id, p_user_id, 
      CASE WHEN p_is_realtime THEN 0 ELSE p_egress_bytes END, 
      CASE WHEN p_is_realtime THEN p_egress_bytes ELSE 0 END,
      CASE WHEN p_is_auth THEN 1 ELSE 0 END, 
      CASE WHEN p_is_email THEN 1 ELSE 0 END,
      1
    )
    ON CONFLICT (firm_id, user_id, metric_date) 
    DO UPDATE SET 
        db_egress_bytes       = user_usage_telemetry.db_egress_bytes + EXCLUDED.db_egress_bytes,
        realtime_egress_bytes = user_usage_telemetry.realtime_egress_bytes + EXCLUDED.realtime_egress_bytes,
        auth_requests         = user_usage_telemetry.auth_requests + EXCLUDED.auth_requests,
        emails_sent           = user_usage_telemetry.emails_sent + EXCLUDED.emails_sent,
        ops_count             = user_usage_telemetry.ops_count + 1,
        api_traffic_bytes     = user_usage_telemetry.api_traffic_bytes + 256; -- Baseline overhead (Calibrated)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RPC: Get Usage Insights (Full fidelity aggregator)
DROP FUNCTION IF EXISTS public.get_usage_insights(uuid);
CREATE OR REPLACE FUNCTION public.get_usage_insights(p_firm_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_db_egress bigint;
    v_realtime_egress bigint;
    v_edge_func_egress bigint;
    v_ops_count bigint;
    v_emails int;
    v_storage_bytes bigint;
    v_api_traffic bigint;
    v_user_count int;
    v_start_date date;
BEGIN
    v_start_date := date_trunc('month', current_date);

    -- 1. Aggregrate from telemetry table
    SELECT 
        coalesce(sum(db_egress_bytes), 0),
        coalesce(sum(realtime_egress_bytes), 0),
        coalesce(sum(edge_func_egress_bytes), 0),
        coalesce(sum(ops_count), 0),
        coalesce(sum(emails_sent), 0),
        coalesce(sum(api_traffic_bytes), 0)
    INTO v_db_egress, v_realtime_egress, v_edge_func_egress, v_ops_count, v_emails, v_api_traffic
    FROM public.user_usage_telemetry 
    WHERE firm_id = p_firm_id AND metric_date >= v_start_date;
    
    -- 2. Query storage metadata
    SELECT coalesce(sum(metadata->'size')::bigint, 0) INTO v_storage_bytes 
    FROM storage.objects WHERE name LIKE p_firm_id || '%';

    -- 3. Profile counts
    SELECT count(*) INTO v_user_count FROM public.profiles WHERE firm_id = p_firm_id;

    RETURN jsonb_build_object(
        'egress', jsonb_build_object(
            'database', v_db_egress,
            'storage', v_storage_bytes,
            'api', v_api_traffic,
            'realtime', v_realtime_egress + (v_ops_count * 256), -- heuristic overhead
            'auth', (v_user_count * 1024 * 2), -- Baseline auth redirect footprint
            'edge_functions', v_edge_func_egress,
            'total_estimate', v_db_egress + v_storage_bytes + v_realtime_egress + v_edge_func_egress + v_api_traffic
        ),
        'metrics', jsonb_build_object(
            'ops', v_ops_count,
            'emails', v_emails,
            'users', v_user_count
        ),
        'top_users', (
            SELECT jsonb_agg(u) FROM (
                SELECT 
                    p.full_name,
                    p.role,
                    sum(t.db_egress_bytes + t.realtime_egress_bytes) as egress,
                    sum(t.ops_count) as operations
                FROM public.user_usage_telemetry t
                JOIN public.profiles p ON t.user_id = p.id
                WHERE t.firm_id = p_firm_id AND t.metric_date >= v_start_date
                GROUP BY p.full_name, p.role
                ORDER BY sum(t.db_egress_bytes + t.realtime_egress_bytes) DESC
                LIMIT 5
            ) u
        ),
        'cycle_start', v_start_date,
        'cycle_end', (v_start_date + interval '1 month' - interval '1 day')::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RLS & Permissions
ALTER TABLE public.user_usage_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_telemetry_select ON public.user_usage_telemetry;
CREATE POLICY usage_telemetry_select ON public.user_usage_telemetry FOR SELECT
  USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin');

GRANT ALL ON public.user_usage_telemetry TO authenticated;
-- Important: Use the EXACT signature for the GRANT
GRANT EXECUTE ON FUNCTION public.record_user_usage(uuid, uuid, bigint, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_insights(uuid) TO authenticated;
