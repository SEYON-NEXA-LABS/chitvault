-- Migration 004: Auction Payout Settlement
-- Adds fields to track when an auction winner is actually paid out.

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS is_payout_settled BOOLEAN DEFAULT FALSE;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS payout_date DATE;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(12,2);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS payout_note TEXT;

-- Index for filtering pending payouts
CREATE INDEX IF NOT EXISTS idx_auctions_settlement ON auctions(firm_id, is_payout_settled);
