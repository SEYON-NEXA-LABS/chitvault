-- Migration: 009_recalculate_ledger_logic.sql
-- Goal: Provide a way to retroactively update all auction records when group rules change.

CREATE OR REPLACE FUNCTION public.recalculate_group_ledger(p_group_id bigint)
RETURNS json AS $$
DECLARE
  r record;
  v_calc json;
  v_group record;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- 1. Loop through all confirmed auctions for this group
  FOR r IN (
    SELECT id, auction_discount FROM auctions 
    WHERE group_id = p_group_id AND status = 'confirmed'
  ) LOOP
    -- Recalculate based on NEWEST group rules
    v_calc := public.calculate_auction(p_group_id, r.auction_discount);
    
    -- Update the auction's dividend/payout
    UPDATE auctions SET
      dividend   = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric
    WHERE id = r.id;

    -- Update the linked commission record
    UPDATE foreman_commissions SET
      commission_amt  = (v_calc->>'commission_amt')::numeric,
      commission_type = (v_calc->>'commission_type')::text,
      paid_to        = (v_calc->>'commission_recipient')::text,
      commission_rate = (v_calc->>'commission_rate')::numeric,
      net_dividend    = (v_calc->>'net_dividend')::numeric,
      per_member_div  = (v_calc->>'per_member_div')::numeric
    WHERE auction_id = r.id;
  END LOOP;

  -- 2. Sync the accumulated_surplus for the group
  UPDATE groups g
  SET accumulated_surplus = (
    SELECT COALESCE(SUM(a.auction_discount - c.commission_amt), 0)
    FROM auctions a
    JOIN foreman_commissions c ON c.auction_id = a.id
    WHERE a.group_id = p_group_id 
      AND a.status = 'confirmed' 
      AND c.status = 'confirmed'
  )
  WHERE id = p_group_id AND g.auction_scheme = 'ACCUMULATION';

  RETURN json_build_object('success', true, 'group_id', p_group_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
