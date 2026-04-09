-- Migration: 010_smart_calculator.sql
-- Goal: Upgrade the auction calculator to support "What-If" simulation overrides.
-- Fix: Remove old signature to prevent "not unique" error.

DROP FUNCTION IF EXISTS public.calculate_auction(bigint, numeric);

CREATE OR REPLACE FUNCTION public.calculate_auction(
  p_group_id bigint,
  p_auction_discount numeric,
  p_comm_type text DEFAULT NULL,
  p_comm_val numeric DEFAULT NULL,
  p_comm_recipient text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_group record;
  v_comm_amt numeric;
  v_raw_payout numeric;
  v_eff_type text;
  v_eff_val numeric;
  v_eff_recipient text;
  v_net_div_pool numeric;
  v_per_member_div numeric;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- Use overrides if provided, else fall back to saved group settings
  v_eff_type      := COALESCE(p_comm_type, v_group.commission_type);
  v_eff_val       := COALESCE(p_comm_val, v_group.commission_value);
  v_eff_recipient := COALESCE(p_comm_recipient, v_group.commission_recipient);

  v_raw_payout := v_group.chit_value - p_auction_discount;

  -- Calculate Commission based on the effective rule
  IF v_eff_type = 'percent_of_chit' THEN
    v_comm_amt := (v_group.chit_value * v_eff_val) / 100;
  ELSIF v_eff_type = 'percent_of_discount' THEN
    v_comm_amt := (p_auction_discount * v_eff_val) / 100;
  ELSIF v_eff_type = 'percent_of_payout' THEN
    v_comm_amt := (v_raw_payout * v_eff_val) / 100;
  ELSIF v_eff_type = 'fixed_amount' THEN
    v_comm_amt := v_eff_val;
  ELSE
    v_comm_amt := (v_group.chit_value * 5) / 100; 
  END IF;

  v_comm_amt := round(v_comm_amt, 2);
  v_net_div_pool := p_auction_discount - v_comm_amt;
  IF v_net_div_pool < 0 THEN v_net_div_pool := 0; END IF;

  v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);

  RETURN json_build_object(
    'chit_value',           v_group.chit_value,
    'auction_discount',     p_auction_discount,
    'commission_type',      v_eff_type,
    'commission_rate',      v_eff_val,
    'commission_amt',       v_comm_amt,
    'commission_recipient', v_eff_recipient,
    'net_dividend',         v_net_div_pool,
    'per_member_div',       v_per_member_div,
    'each_pays',            v_group.monthly_contribution - v_per_member_div,
    'net_payout',           v_raw_payout
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
