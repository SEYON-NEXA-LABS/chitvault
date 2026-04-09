-- Migration: 008_fix_commission_and_surplus_logic.sql
-- Goal: 1. Fix calculation logic. 2. Correct existing faulty records. 3. Automate Net Surplus accumulation.

-- 1. Correct calculate_auction to handle all types and include recipient/type in result
CREATE OR REPLACE FUNCTION public.calculate_auction(
  p_group_id bigint,
  p_auction_discount numeric
)
RETURNS json AS $$
DECLARE
  v_group record;
  v_comm_amt numeric;
  v_net_div_pool numeric;
  v_per_member_div numeric;
  v_net_payout numeric;
  v_raw_payout numeric;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- Standard Payout = Chit Value - Auction Discount (the Bid)
  v_raw_payout := v_group.chit_value - p_auction_discount;

  -- Commission logic (Support all 4 types from settings)
  IF v_group.commission_type = 'percent_of_chit' THEN
    v_comm_amt := (v_group.chit_value * v_group.commission_value) / 100;
  ELSIF v_group.commission_type = 'percent_of_discount' THEN
    v_comm_amt := (p_auction_discount * v_group.commission_value) / 100;
  ELSIF v_group.commission_type = 'percent_of_payout' THEN
    v_comm_amt := (v_raw_payout * v_group.commission_value) / 100;
  ELSIF v_group.commission_type = 'fixed_amount' THEN
    v_comm_amt := v_group.commission_value;
  ELSE
    -- Default/Fallback to 5% of Chit if something is corrupted
    v_comm_amt := (v_group.chit_value * 5) / 100; 
  END IF;

  -- Final Rounding and Dividend calculation
  v_comm_amt := round(v_comm_amt, 2);
  
  -- The Net Dividend Pool is what remains of the Surplus (Discount) after deducting commission
  v_net_div_pool := p_auction_discount - v_comm_amt;
  
  -- Prevent negative dividend pools (safety)
  IF v_net_div_pool < 0 THEN v_net_div_pool := 0; END IF;

  v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);
  v_net_payout := v_raw_payout;

  RETURN json_build_object(
    'chit_value',           v_group.chit_value,
    'auction_discount',     p_auction_discount,
    'discount',             p_auction_discount,
    'commission_type',      v_group.commission_type,
    'commission_rate',      v_group.commission_value,
    'commission_amt',       v_comm_amt,
    'commission_recipient', v_group.commission_recipient,
    'net_dividend',         v_net_div_pool,
    'per_member_div',       v_per_member_div,
    'each_pays',            v_group.monthly_contribution - v_per_member_div,
    'net_payout',           v_net_payout
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Correct record_auction_with_commission to use ACTUAL group settings and maintain NET surplus
CREATE OR REPLACE FUNCTION public.record_auction_with_commission(
  p_group_id bigint,
  p_month int,
  p_auction_date date,
  p_winner_id bigint,
  p_auction_discount numeric,
  p_foreman_member_id bigint,
  p_notes text,
  p_status text,
  p_auction_id bigint DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_firm_id uuid;
  v_auction_id bigint;
  v_calc json;
  g record;
BEGIN
  -- Fetch group settings
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  
  v_firm_id := g.firm_id;
  
  -- Calculate using the corrected logic above
  SELECT calculate_auction(p_group_id, p_auction_discount) INTO v_calc;

  IF p_auction_id IS NOT NULL THEN
    v_auction_id := p_auction_id;
    UPDATE auctions SET
      auction_date = p_auction_date,
      winner_id = p_winner_id,
      auction_discount = p_auction_discount,
      total_pot = g.chit_value,
      dividend = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric,
      status = p_status,
      notes = p_notes,
      updated_at = now()
    WHERE id = v_auction_id;
    
    DELETE FROM foreman_commissions WHERE auction_id = v_auction_id;
  ELSE
    INSERT INTO auctions (firm_id, group_id, month, auction_date, winner_id, auction_discount, total_pot, dividend, net_payout, status, notes)
    VALUES (
      v_firm_id, p_group_id, p_month, p_auction_date, p_winner_id,
      p_auction_discount, g.chit_value, (v_calc->>'per_member_div')::numeric, (v_calc->>'net_payout')::numeric, p_status, p_notes
    ) RETURNING id INTO v_auction_id;
  END IF;

  -- Insert foreman commission using ACTUAL group settings
  INSERT INTO foreman_commissions (
    firm_id, group_id, auction_id, month,
    chit_value, auction_discount, discount,
    commission_type, commission_rate, commission_amt,
    net_dividend, per_member_div, paid_to, foreman_member_id, notes, status
  ) VALUES (
    v_firm_id, p_group_id, v_auction_id, p_month,
    g.chit_value, p_auction_discount, (v_calc->>'discount')::numeric,
    g.commission_type, g.commission_value, (v_calc->>'commission_amt')::numeric,
    (v_calc->>'net_dividend')::numeric, (v_calc->>'per_member_div')::numeric, 
    g.commission_recipient, p_foreman_member_id, p_notes, p_status
  );

  -- 3. Maintenance: Update the Group's accumulated_surplus ledger (NET ONLY)
  UPDATE groups g_upd
  SET accumulated_surplus = (
    SELECT COALESCE(SUM(a.auction_discount - c.commission_amt), 0)
    FROM auctions a
    JOIN foreman_commissions c ON c.auction_id = a.id
    WHERE a.group_id = p_group_id 
      AND a.status = 'confirmed' 
      AND c.status = 'confirmed'
  )
  WHERE id = p_group_id AND g_upd.auction_scheme = 'ACCUMULATION';

  RETURN json_build_object('auction_id', v_auction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ONE-TIME CLEANUP PART A: Correct faulty commission amounts for existing auctions
DO $$
DECLARE
  r record;
  v_calc json;
BEGIN
  FOR r IN (
    SELECT a.id as auc_id, a.group_id, a.auction_discount
    FROM auctions a
    WHERE a.status = 'confirmed'
  ) LOOP
    -- Call the fixed calculator for each existing auction
    v_calc := public.calculate_auction(r.group_id, r.auction_discount);
    
    -- Update the linked commission record with corrected values & type/recipient
    UPDATE foreman_commissions SET
      commission_amt  = (v_calc->>'commission_amt')::numeric,
      commission_type = (v_calc->>'commission_type')::text,
      paid_to        = (v_calc->>'commission_recipient')::text,
      commission_rate = (v_calc->>'commission_rate')::numeric,
      net_dividend    = (v_calc->>'net_dividend')::numeric,
      per_member_div  = (v_calc->>'per_member_div')::numeric
    WHERE auction_id = r.auc_id;
  END LOOP;
END $$;

-- 5. ONE-TIME CLEANUP PART B: Sync all groups to the new NET accumulated surplus
UPDATE groups g
SET accumulated_surplus = (
  SELECT COALESCE(SUM(a.auction_discount - c.commission_amt), 0)
  FROM auctions a
  JOIN foreman_commissions c ON c.auction_id = a.id
  WHERE a.group_id = g.id 
    AND a.status = 'confirmed' 
    AND c.status = 'confirmed'
)
WHERE g.auction_scheme = 'ACCUMULATION';
