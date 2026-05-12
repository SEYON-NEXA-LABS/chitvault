-- Migration: 009_recalculate_ledger_logic.sql
-- Goal: Provide a way to retroactively update all auction records when group rules change.

CREATE OR REPLACE FUNCTION public.recalculate_group_ledger(p_group_id bigint)
RETURNS json AS $$
DECLARE
  r record;
  v_calc json;
  v_group record;
  v_bid_to_use numeric;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- 1. Loop through all confirmed auctions for this group
  FOR r IN (
    SELECT a.id, a.auction_discount, g.auction_scheme, g.chit_value 
    FROM auctions a 
    JOIN groups g ON g.id = a.group_id
    WHERE a.group_id = p_group_id AND a.status = 'confirmed'
  ) LOOP
    -- Determine what the "Bid" was based on existing columns
    IF r.auction_scheme = 'DIVIDEND_SHARE' THEN
      v_bid_to_use := r.chit_value - r.auction_discount;
    ELSE
      v_bid_to_use := r.auction_discount;
    END IF;

    -- Recalculate based on NEWEST group rules
    v_calc := public.calculate_auction(p_group_id, v_bid_to_use);
    
    -- Update the auction's dividend/payout
    UPDATE auctions SET
      dividend   = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric,
      auction_discount = (v_calc->>'auction_discount')::numeric
    WHERE id = r.id;

    -- Update the linked commission record
    UPDATE foreman_commissions SET
      commission_amt  = (v_calc->>'commission_amt')::numeric,
      commission_type = (v_calc->>'commission_type')::text,
      paid_to        = (v_calc->>'commission_recipient')::text,
      commission_rate = (v_calc->>'commission_rate')::numeric,
      net_dividend    = (v_calc->>'net_dividend')::numeric,
      per_member_div  = (v_calc->>'per_member_div')::numeric,
      auction_discount = (v_calc->>'auction_discount')::numeric,
      discount       = v_bid_to_use
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
