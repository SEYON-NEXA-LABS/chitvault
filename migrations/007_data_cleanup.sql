-- 007_data_cleanup.sql

-- Reset min_bid_pct for groups where it's higher than 10% (likely an old Payout floor)
-- Standard Min Discount is 5% (to cover foreman commission)
UPDATE public.groups 
SET min_bid_pct = 0.05
WHERE min_bid_pct > 0.10;

-- Reset max_bid_pct for groups where it's lower than 10% or higher than 50%
-- Standard Max Discount cap is around 30-40%
UPDATE public.groups 
SET max_bid_pct = 0.40
WHERE max_bid_pct > 0.50 OR max_bid_pct < 0.10;

-- Ensure discount_cap_pct matches max_bid_pct as the new standard
UPDATE public.groups
SET discount_cap_pct = max_bid_pct;

-- ── SCHEMA REFACTOR: BID_AMOUNT TO AUCTION_DISCOUNT ─────────────
-- Idempotent check for 'auctions' table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auctions' AND column_name = 'bid_amount') THEN
    ALTER TABLE auctions RENAME COLUMN bid_amount TO auction_discount;
  END IF;
END $$;

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS notes text;

-- Idempotent check for 'foreman_commissions' table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'foreman_commissions' AND column_name = 'bid_amount') THEN
    ALTER TABLE foreman_commissions RENAME COLUMN bid_amount TO auction_discount;
  END IF;
END $$;

-- Re-apply updated RPCs with new terminology
DROP FUNCTION IF EXISTS public.calculate_auction(bigint, numeric);
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
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  
  -- Commission logic
  IF v_group.commission_type = 'percent_of_chit' THEN
    v_comm_amt := (v_group.chit_value * v_group.commission_value) / 100;
  ELSIF v_group.commission_type = 'percent_of_discount' THEN
    v_comm_amt := (p_auction_discount * v_group.commission_value) / 100;
  ELSIF v_group.commission_type = 'fixed_amount' THEN
    v_comm_amt := v_group.commission_value;
  ELSE
    v_comm_amt := 500; -- Fallback
  END IF;

  v_net_div_pool := p_auction_discount - v_comm_amt;
  v_per_member_div := v_net_div_pool / v_group.num_members;
  v_net_payout := v_group.chit_value - p_auction_discount;

  RETURN json_build_object(
    'chit_value', v_group.chit_value,
    'auction_discount', p_auction_discount,
    'discount', p_auction_discount,
    'commission_rate', v_group.commission_value,
    'commission_amt', v_comm_amt,
    'net_dividend', v_net_div_pool,
    'per_member_div', v_per_member_div,
    'net_payout', v_net_payout
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.record_auction_with_commission(bigint, int, date, bigint, numeric, bigint, text, text, bigint);
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
  SELECT firm_id, chit_value, duration, auction_scheme INTO g FROM groups WHERE id = p_group_id;
  v_firm_id := g.firm_id;
  
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
      notes = p_notes
    WHERE id = v_auction_id;
    
    DELETE FROM foreman_commissions WHERE auction_id = v_auction_id;
  ELSE
    INSERT INTO auctions (firm_id, group_id, month, auction_date, winner_id, auction_discount, total_pot, dividend, net_payout, status, notes)
    VALUES (
      v_firm_id, p_group_id, p_month, p_auction_date, p_winner_id,
      p_auction_discount, g.chit_value, (v_calc->>'per_member_div')::numeric, (v_calc->>'net_payout')::numeric, p_status, p_notes
    ) RETURNING id INTO v_auction_id;
  END IF;

  -- Insert foreman commission
  INSERT INTO foreman_commissions (
    firm_id, group_id, auction_id, month,
    chit_value, auction_discount, discount,
    commission_type, commission_rate, commission_amt,
    net_dividend, per_member_div, paid_to, foreman_member_id, notes, status
  ) VALUES (
    v_firm_id, p_group_id, v_auction_id, p_month,
    g.chit_value, p_auction_discount, (v_calc->>'discount')::numeric,
    'percent_of_chit', (v_calc->>'commission_rate')::numeric, (v_calc->>'commission_amt')::numeric,
    (v_calc->>'net_dividend')::numeric, (v_calc->>'per_member_div')::numeric, 
    'foreman', p_foreman_member_id, p_notes, p_status
  );

  RETURN json_build_object('auction_id', v_auction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
