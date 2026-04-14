-- Migration: 013_fix_auction_payout_logic.sql
-- Goal: Update calculate_auction to handle different auction schemes correctly and persist net_payout.

DROP FUNCTION IF EXISTS public.calculate_auction(bigint, numeric, text, numeric, text);

CREATE OR REPLACE FUNCTION public.calculate_auction(
  p_group_id bigint,
  p_bid_amount numeric, -- The amount entered by the user (Winning Bid or Discount Bid)
  p_comm_type text DEFAULT NULL,
  p_comm_val numeric DEFAULT NULL,
  p_comm_recipient text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_group record;
  v_comm_amt numeric;
  v_raw_payout numeric;
  v_discount numeric;
  v_eff_type text;
  v_eff_val numeric;
  v_eff_recipient text;
  v_net_div_pool numeric;
  v_per_member_div numeric;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- 1. Determine Payout & Discount based on scheme
  IF v_group.auction_scheme = 'DIVIDEND' THEN
    -- Dividend (Normal): User enters the Winning Bid (what the member takes)
    v_raw_payout := p_bid_amount;
    v_discount   := v_group.chit_value - p_bid_amount;
  ELSE 
    -- Accumulation: User enters the Discount Bid (what stays with the firm/group)
    v_raw_payout := v_group.chit_value - p_bid_amount;
    v_discount   := p_bid_amount;
  END IF;

  -- 2. Resolve Commission settings (overrides or group defaults)
  v_eff_type      := COALESCE(p_comm_type, v_group.commission_type);
  v_eff_val       := COALESCE(p_comm_val, v_group.commission_value);
  v_eff_recipient := COALESCE(p_comm_recipient, v_group.commission_recipient);

  -- 3. Calculate Commission
  IF v_eff_type = 'percent_of_chit' THEN
    v_comm_amt := (v_group.chit_value * v_eff_val) / 100;
  ELSIF v_eff_type = 'percent_of_discount' THEN
    v_comm_amt := (v_discount * v_eff_val) / 100;
  ELSIF v_eff_type = 'percent_of_payout' THEN
    v_comm_amt := (v_raw_payout * v_eff_val) / 100;
  ELSIF v_eff_type = 'fixed_amount' THEN
    v_comm_amt := v_eff_val;
  ELSE
    v_comm_amt := (v_group.chit_value * 5) / 100; 
  END IF;

  v_comm_amt := round(v_comm_amt, 2);
  
  -- 4. Dividend calculation
  IF v_group.auction_scheme = 'DIVIDEND' THEN
    v_net_div_pool := v_discount - v_comm_amt;
    IF v_net_div_pool < 0 THEN v_net_div_pool := 0; END IF;
    v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);
  ELSE 
    -- Accumulation groups don't pay immediate dividends
    v_net_div_pool := 0;
    v_per_member_div := 0;
  END IF;

  RETURN json_build_object(
    'chit_value',           v_group.chit_value,
    'auction_discount',     v_discount,
    'commission_type',      v_eff_type,
    'commission_rate',      v_eff_val,
    'commission_amt',       v_comm_amt,
    'commission_recipient', v_eff_recipient,
    'net_dividend',         v_net_div_pool,
    'per_member_div',       v_per_member_div,
    'each_pays',            v_group.monthly_contribution - v_per_member_div,
    'net_payout',           v_raw_payout - v_comm_amt, -- Payout is net of commission
    'raw_payout',           v_raw_payout,
    'auction_scheme',       v_group.auction_scheme
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update record_auction_with_commission to use the new calculator results correctly
CREATE OR REPLACE FUNCTION public.record_auction_with_commission(
  p_group_id bigint,
  p_month int,
  p_auction_date date,
  p_winner_id bigint,
  p_bid_amount numeric, -- Entered amount
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
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  
  v_firm_id := g.firm_id;
  
  -- Calculate using the corrected logic
  SELECT calculate_auction(p_group_id, p_bid_amount) INTO v_calc;

  IF p_auction_id IS NOT NULL THEN
    v_auction_id := p_auction_id;
    UPDATE auctions SET
      auction_date = p_auction_date,
      winner_id = p_winner_id,
      auction_discount = (v_calc->>'auction_discount')::numeric,
      total_pot = (v_calc->>'chit_value')::numeric,
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
      (v_calc->>'auction_discount')::numeric, (v_calc->>'chit_value')::numeric, 
      (v_calc->>'per_member_div')::numeric, (v_calc->>'net_payout')::numeric, p_status, p_notes
    ) RETURNING id INTO v_auction_id;
  END IF;

  INSERT INTO foreman_commissions (
    firm_id, group_id, auction_id, month,
    chit_value, auction_discount, discount,
    commission_type, commission_rate, commission_amt,
    net_dividend, per_member_div, paid_to, foreman_member_id, notes, status
  ) VALUES (
    v_firm_id, p_group_id, v_auction_id, p_month,
    g.chit_value, (v_calc->>'auction_discount')::numeric, p_bid_amount,
    (v_calc->>'commission_type')::text, (v_calc->>'commission_rate')::numeric, (v_calc->>'commission_amt')::numeric,
    (v_calc->>'net_dividend')::numeric, (v_calc->>'per_member_div')::numeric, 
    (v_calc->>'commission_recipient')::text, p_foreman_member_id, p_notes, p_status
  );

  -- Update accumulated surplus for ACCUMULATION groups
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
