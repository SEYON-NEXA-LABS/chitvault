-- Drop the old 4-param overload to prevent function resolution ambiguity
DROP FUNCTION IF EXISTS public.get_collection_workspace(uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_collection_workspace(
  p_firm_id uuid,
  p_search text DEFAULT '',
  p_group_id int DEFAULT NULL, -- NEW: Optional group filter
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  person_id bigint,
  person_name text,
  person_phone text,
  person_address text,
  total_balance numeric,
  overdue_count int,
  is_overdue boolean,
  memberships jsonb,
  total_count bigint
) AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- 1. Get total count for pagination (accounting for group filter)
  SELECT COUNT(DISTINCT p.id) INTO v_total_count
  FROM persons p
  JOIN members m ON m.person_id = p.id
  WHERE p.firm_id = p_firm_id
    AND m.deleted_at IS NULL
    AND (p_group_id IS NULL OR m.group_id = p_group_id)
    AND (p.name ILIKE '%' || p_search || '%' OR p.phone ILIKE '%' || p_search || '%');

  RETURN QUERY
  WITH person_list AS (
    -- Get paginated list of persons
    SELECT p.id, p.name, p.phone, p.address
    FROM persons p
    JOIN members m ON m.person_id = p.id
    WHERE p.firm_id = p_firm_id
      AND m.deleted_at IS NULL
      AND (p_group_id IS NULL OR m.group_id = p_group_id)
      AND (p.name ILIKE '%' || p_search || '%' OR p.phone ILIKE '%' || p_search || '%')
    GROUP BY p.id
    ORDER BY p.name ASC
    LIMIT p_limit OFFSET p_offset
  ),
  membership_financials AS (
    -- Calculate dues for each membership
    SELECT 
      m.id as member_id,
      m.person_id,
      m.group_id,
      g.name as group_name,
      g.auction_scheme,
      g.monthly_contribution,
      COALESCE((SELECT MAX(month) FROM auctions WHERE group_id = m.group_id AND status = 'confirmed'), 0) as latest_month
    FROM members m
    JOIN groups g ON g.id = m.group_id
    WHERE m.person_id IN (SELECT id FROM person_list)
      AND m.deleted_at IS NULL
      AND (p_group_id IS NULL OR m.group_id = p_group_id) -- Only show selected group membership if filtered
  ),
  detailed_dues AS (
    SELECT 
      mf.member_id,
      mf.person_id,
      mf.group_id,
      mf.group_name,
      mf.latest_month,
      mf.monthly_contribution,
      mf.auction_scheme,
      (
        SELECT jsonb_agg(d) FROM (
          SELECT 
            gs.m as month,
            mf.monthly_contribution - COALESCE(a.dividend, 0) as amount_due,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = mf.member_id AND month = gs.m AND deleted_at IS NULL) as amount_paid,
            a.status as auction_status
          FROM generate_series(1, mf.latest_month + 1) gs(m)
          LEFT JOIN auctions a ON a.group_id = mf.group_id AND a.month = gs.m AND a.status = 'confirmed'
          WHERE gs.m <= (SELECT duration FROM groups WHERE id = mf.group_id)
        ) d
        WHERE d.amount_paid < (d.amount_due - 0.01)
      ) as pending_months
    FROM membership_financials mf
  ),
  aggregated_memberships AS (
    SELECT 
      dd.person_id,
      SUM(
        COALESCE((SELECT SUM(amount_due - amount_paid) FROM jsonb_to_recordset(dd.pending_months) as x(month int, amount_due numeric, amount_paid numeric)), 0)
      ) as total_person_balance,
      MAX(
        COALESCE((SELECT COUNT(*) FROM jsonb_to_recordset(dd.pending_months) as x(month int, status text) WHERE x.status = 'confirmed'), 0)::int
      ) as overdue_months_count,
      jsonb_agg(jsonb_build_object(
        'member', (SELECT row_to_json(m) FROM members m WHERE m.id = dd.member_id),
        'group', (SELECT row_to_json(g) FROM groups g WHERE g.id = dd.group_id),
        'totalBalance', COALESCE((SELECT SUM(amount_due - amount_paid) FROM jsonb_to_recordset(dd.pending_months) as x(month int, amount_due numeric, amount_paid numeric)), 0),
        'latestMonth', dd.latest_month,
        'dues', dd.pending_months
      )) as membership_data
    FROM detailed_dues dd
    GROUP BY dd.person_id
  )
  SELECT 
    pl.id,
    pl.name,
    pl.phone,
    pl.address,
    COALESCE(am.total_person_balance, 0),
    COALESCE(am.overdue_months_count, 0),
    COALESCE(am.total_person_balance, 0) > 0.01,
    COALESCE(am.membership_data, '[]'::jsonb),
    v_total_count
  FROM person_list pl
  LEFT JOIN aggregated_memberships am ON am.person_id = pl.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
