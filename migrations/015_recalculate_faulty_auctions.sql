-- Migration: 015_recalculate_faulty_auctions.sql
-- Goal: Synchronize existing auctions with the corrected financial logic.

CREATE OR REPLACE FUNCTION public.recalculate_all_auctions()
RETURNS void AS $$
DECLARE
  v_auc record;
  v_calc json;
  v_bid_to_use numeric;
  v_group record;
BEGIN
  FOR v_auc IN SELECT a.*, g.auction_scheme, g.chit_value FROM auctions a JOIN groups g ON g.id = a.group_id LOOP
    
    -- Determine what the "Bid" was based on existing columns
    IF v_auc.auction_scheme = 'DIVIDEND' THEN
      v_bid_to_use := v_auc.chit_value - v_auc.auction_discount;
    ELSE
      v_bid_to_use := v_auc.auction_discount;
    END IF;

    -- Get corrected values from the new RPC
    v_calc := public.calculate_auction(v_auc.group_id, v_bid_to_use);

    -- Update Auctions table
    UPDATE auctions SET
      net_payout = (v_calc->>'net_payout')::numeric,
      dividend = (v_calc->>'net_dividend')::numeric,
      auction_discount = (v_calc->>'auction_discount')::numeric,
      updated_at = now()
    WHERE id = v_auc.id;

    -- Update Foreman Commissions table if it exists for this auction
    UPDATE foreman_commissions SET
      commission_amt = (v_calc->>'commission_amt')::numeric,
      net_dividend = (v_calc->>'net_dividend')::numeric,
      per_member_div = (v_calc->>'per_member_div')::numeric,
      auction_discount = (v_calc->>'auction_discount')::numeric,
      discount = v_bid_to_use, -- Consistently store the "Bid" here
      updated_at = now()
    WHERE auction_id = v_auc.id;

  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the recalculation
SELECT public.recalculate_all_auctions();

-- Clean up the temporary function
DROP FUNCTION IF EXISTS public.recalculate_all_auctions();
