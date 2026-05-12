-- Migration: 033_consolidate_dividend_strategy.sql
-- Goal: Support three distinct dividend/commission strategies.

-- 1. Ensure the new column exists
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS dividend_strategy text DEFAULT 'pro_n';

-- 2. Update calculate_auction to handle 3 strategies
-- standard: Comm from Pool, Div by N
-- pro_n1: Comm from Winner, Div by N-1
-- pro_n:  Comm from Winner, Div by N
CREATE OR REPLACE FUNCTION public.calculate_auction(
  p_group_id bigint,
  p_bid_amount numeric,
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
  v_strategy text; 
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  v_strategy := COALESCE(v_group.dividend_strategy, 'standard');

  -- 1. Determine Payout & Discount based on scheme
  IF v_group.auction_scheme = 'DIVIDEND_SHARE' THEN
    v_raw_payout := p_bid_amount;
    v_discount   := v_group.chit_value - p_bid_amount;
  ELSE 
    v_raw_payout := v_group.chit_value - p_bid_amount;
    v_discount   := p_bid_amount;
  END IF;

  -- 2. Resolve Commission settings
  v_eff_type      := COALESCE(p_comm_type, v_group.commission_type);
  v_eff_val       := COALESCE(p_comm_val, v_group.commission_value);
  v_eff_recipient := COALESCE(p_comm_recipient, v_group.commission_recipient);

  -- 3. Calculate Commission Amount
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
  
  -- 4. CONSOLIDATED STRATEGY LOGIC
  IF v_strategy = 'pro_n1' THEN
    v_net_div_pool := v_discount; 
    v_per_member_div := round(v_net_div_pool / (v_group.num_members - 1), 2);
  ELSIF v_strategy = 'pro_n' THEN
    v_net_div_pool := v_discount; 
    v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);
  ELSE
    -- standard
    v_net_div_pool := v_discount - v_comm_amt; 
    IF v_net_div_pool < 0 THEN v_net_div_pool := 0; END IF;
    v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);
  END IF;

  RETURN json_build_object(
    'chit_value',           v_group.chit_value,
    'auction_discount',     v_discount,
    'commission_type',      v_eff_type,
    'commission_rate',      v_eff_val,
    'commission_amt',       v_comm_amt,
    'commission_recipient', v_eff_recipient,
    'dividend_strategy',    v_strategy,
    'net_dividend',         v_net_div_pool,
    'per_member_div',       v_per_member_div,
    'each_pays',            CASE WHEN v_group.auction_scheme = 'DIVIDEND_SHARE' THEN (v_group.monthly_contribution - v_per_member_div) ELSE v_group.monthly_contribution END,
    'net_payout',           CASE WHEN v_strategy LIKE 'pro_%' THEN v_raw_payout - v_comm_amt ELSE v_raw_payout END,
    'raw_payout',           v_raw_payout,
    'auction_scheme',       v_group.auction_scheme
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
