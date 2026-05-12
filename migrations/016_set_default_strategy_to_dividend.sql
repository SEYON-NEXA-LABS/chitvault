-- Migration: 016_set_default_strategy_to_dividend.sql
-- Goal: Align with user core agenda by making 'deduct_from_dividend' the default strategy.

-- 1. Change default for future groups
ALTER TABLE public.groups 
ALTER COLUMN commission_strategy SET DEFAULT 'deduct_from_dividend';

-- 2. Update existing groups that are still on the old default
-- (Assuming groups created with 'deduct_from_payout' by default should be moved to the new standard)
UPDATE public.groups 
SET commission_strategy = 'deduct_from_dividend' 
WHERE commission_strategy = 'deduct_from_payout';

-- 3. Retroactively recalculate all affected groups
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.groups LOOP
    PERFORM public.recalculate_group_ledger(r.id);
  END LOOP;
END $$;

-- 4. Ensure calculate_auction also uses the new default logic if null
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

  v_strategy := COALESCE(v_group.commission_strategy, 'deduct_from_dividend');

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
  
  -- 4. Dividend calculation based on strategy
  IF v_strategy = 'deduct_from_dividend' THEN
    v_net_div_pool := v_discount - v_comm_amt;
  ELSE
    v_net_div_pool := v_discount;
  END IF;

  IF v_net_div_pool < 0 THEN v_net_div_pool := 0; END IF;
  
  v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);

  RETURN json_build_object(
    'chit_value',           v_group.chit_value,
    'auction_discount',     v_discount,
    'commission_type',      v_eff_type,
    'commission_rate',      v_eff_val,
    'commission_amt',       v_comm_amt,
    'commission_recipient', v_eff_recipient,
    'commission_strategy',  v_strategy,
    'net_dividend',         v_net_div_pool,
    'per_member_div',       v_per_member_div,
    'each_pays',            CASE WHEN v_group.auction_scheme = 'DIVIDEND_SHARE' THEN (v_group.monthly_contribution - v_per_member_div) ELSE v_group.monthly_contribution END,
    'net_payout',           CASE WHEN v_strategy = 'deduct_from_payout' THEN v_raw_payout - v_comm_amt ELSE v_raw_payout END,
    'raw_payout',           v_raw_payout,
    'auction_scheme',       v_group.auction_scheme
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
