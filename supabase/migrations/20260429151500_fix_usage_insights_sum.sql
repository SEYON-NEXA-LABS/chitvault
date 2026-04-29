-- Fix: Resolve "function sum(jsonb) does not exist" in usage insights
-- The metadata->'size' returns a jsonb object which cannot be summed directly.
-- We must use ->> to get the text value and cast it to bigint.

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
    
    -- 2. Query storage metadata (FIXED CASTING HERE)
    SELECT coalesce(sum((metadata->>'size')::bigint), 0) INTO v_storage_bytes 
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
