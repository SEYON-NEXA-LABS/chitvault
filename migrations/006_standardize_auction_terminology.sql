-- 006_standardize_auction_terminology.sql

-- 1. Update Group table defaults for min/max bids to reflect DISCOUNTS (5% to 40%)
ALTER TABLE public.groups 
  ALTER COLUMN min_bid_pct SET DEFAULT 0.05,
  ALTER COLUMN max_bid_pct SET DEFAULT 0.40;

-- 2. Data Migration: Fix existing groups with the old 70% payout floor
-- If min_bid_pct was 0.70, it's likely intended as a 5% commission floor in the new logic
UPDATE public.groups 
SET min_bid_pct = 0.05, 
    max_bid_pct = 0.40 
WHERE min_bid_pct = 0.70;

-- 3. Fix the calculate_auction RPC logic
CREATE OR REPLACE FUNCTION public.calculate_auction(
  p_group_id  bigint,
  p_bid_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g            groups%rowtype;
  v_min_bid    numeric(12,2);
  v_max_bid    numeric(12,2);
  v_discount   numeric(12,2);
  v_cap        numeric(12,2);
  v_commission numeric(12,2);
  v_net_div    numeric(12,2);
  v_per_member numeric(12,2);
  v_num_members int;
  v_raw_payout numeric(12,2);
  v_net_payout numeric(12,2);
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id AND firm_id = my_firm_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- Logic: p_bid_amount IS the Discount Amount (the amount bid "away")
  v_discount := p_bid_amount;
  v_raw_payout := g.chit_value - p_bid_amount;

  -- Enforce bid range (Now comparing discount against floor/cap)
  v_min_bid := round(g.chit_value * g.min_bid_pct, 2);
  v_max_bid := round(g.chit_value * g.max_bid_pct, 2);

  IF v_discount < v_min_bid THEN
    RAISE EXCEPTION 'Auction discount ₹% is below minimum allowed ₹%', v_discount, v_min_bid;
  END IF;
  IF v_discount > v_max_bid THEN
    RAISE EXCEPTION 'Auction discount ₹% exceeds maximum allowed ₹%', v_discount, v_max_bid;
  END IF;

  -- Also check the dedicated discount_cap_pct if set differently
  v_cap := round(g.chit_value * g.discount_cap_pct, 2);
  IF v_discount > v_cap THEN
    RAISE EXCEPTION 'Auction discount ₹% exceeds pool cap ₹% (% of chit value)', v_discount, v_cap, (g.discount_cap_pct * 100);
  END IF;

  -- Calculate foreman commission
  CASE g.commission_type
    WHEN 'percent_of_chit'     THEN v_commission := round(g.chit_value * g.commission_value / 100, 2);
    WHEN 'percent_of_discount' THEN v_commission := round(v_discount    * g.commission_value / 100, 2);
    WHEN 'percent_of_payout'   THEN v_commission := round(v_raw_payout * g.commission_value / 100, 2);
    WHEN 'fixed_amount'        THEN v_commission := g.commission_value;
    ELSE v_commission := 0;
  END CASE;

  -- Standard Logic: 
  -- 1. Winner takes Payout = Chit - Discount
  -- 2. Group gets Dividend = Discount - Commission
  v_net_payout := v_raw_payout; 
  v_net_div    := v_discount - v_commission;
  
  IF v_net_div < 0 THEN v_net_div := 0; END IF;

  IF g.auction_scheme = 'ACCUMULATION' THEN
     v_per_member := 0;
  ELSE
     -- Count active members
     SELECT count(*) INTO v_num_members FROM members
     WHERE group_id = p_group_id AND firm_id = my_firm_id() AND status IN ('active','foreman');
     v_num_members := greatest(v_num_members, 1);
     v_per_member  := round(v_net_div / v_num_members, 2);
  END IF;

  RETURN jsonb_build_object(
    'chit_value',      g.chit_value,
    'bid_amount',      p_bid_amount,      -- Now strictly the discount
    'min_bid',         v_min_bid,
    'max_bid',         v_max_bid,
    'discount',        v_discount,
    'discount_cap',    v_cap,
    'commission_type', g.commission_type,
    'commission_rate', g.commission_value,
    'commission_amt',  v_commission,
    'commission_recipient', g.commission_recipient,
    'net_dividend',    v_net_div,
    'num_members',     v_num_members,
    'per_member_div',  v_per_member,
    'each_pays',       g.monthly_contribution - v_per_member,
    'net_payout',      v_net_payout
  );
END;
$$;
