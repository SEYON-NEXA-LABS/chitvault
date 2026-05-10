-- Enhanced Daily Reconciliation RPC
-- Goal: Tally daily cash drawer by combining Member Collections (Cash) 
-- and Realized Commissions from Cash-based settlements.

CREATE OR REPLACE FUNCTION public.get_daily_reconciliation(
  p_firm_id   uuid,
  p_start_date date,
  p_end_date   date
)
RETURNS TABLE (
  entry_date    date,
  expected_cash numeric(12,2),
  actual_cash   numeric(12,2),
  is_verified   boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as d
  ),
  daily_collections AS (
    -- Sum of all physical cash receipts from members
    SELECT 
      payment_date as d,
      COALESCE(SUM(amount), 0) as total_collected
    FROM payments
    WHERE firm_id = p_firm_id 
      AND mode = 'Cash' 
      AND deleted_at IS NULL
      AND payment_date >= p_start_date
      AND payment_date <= p_end_date
    GROUP BY 1
  ),
  daily_commissions AS (
    -- Sum of all commissions realized from cash payouts
    -- (Commission remains in the drawer when we pay out less cash than the gross prize)
    SELECT 
      a.payout_date as d,
      COALESCE(SUM(fc.commission_amt), 0) as total_commissions
    FROM foreman_commissions fc
    JOIN auctions a ON fc.auction_id = a.id
    WHERE fc.firm_id = p_firm_id 
      AND a.payout_mode = 'Cash' 
      AND a.deleted_at IS NULL
      AND a.payout_date >= p_start_date
      AND a.payout_date <= p_end_date
    GROUP BY 1
  ),
  daily_physical AS (
    -- Sum of physical cash entered in the denominations (cashbook) table
    SELECT 
      entry_date as d,
      COALESCE(SUM(total), 0) as total_physical,
      BOOL_OR(is_verified) as verified
    FROM denominations
    WHERE firm_id = p_firm_id 
      AND deleted_at IS NULL
      AND entry_date >= p_start_date
      AND entry_date <= p_end_date
    GROUP BY 1
  )
  SELECT 
    dr.d as entry_date,
    (COALESCE(dc.total_collected, 0) + COALESCE(dcomm.total_commissions, 0))::numeric(12,2) as expected_cash,
    COALESCE(dp.total_physical, 0)::numeric(12,2) as actual_cash,
    COALESCE(dp.verified, false) as is_verified
  FROM date_range dr
  LEFT JOIN daily_collections dc ON dr.d = dc.d
  LEFT JOIN daily_commissions dcomm ON dr.d = dcomm.d
  LEFT JOIN daily_physical    dp ON dr.d = dp.d
  WHERE (COALESCE(dc.total_collected, 0) + COALESCE(dcomm.total_commissions, 0) + COALESCE(dp.total_physical, 0)) > 0
  ORDER BY dr.d DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_reconciliation(uuid, date, date) TO authenticated;
