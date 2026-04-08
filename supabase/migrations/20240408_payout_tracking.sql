-- Migration: Add Payout Tracking Details to Auctions table
-- Purpose: To store the payment method and reference notes for winner payouts.

ALTER TABLE auctions 
ADD COLUMN IF NOT EXISTS payout_mode TEXT,
ADD COLUMN IF NOT EXISTS payout_note TEXT;

-- Note: 
-- payout_mode: Stores 'Cash', 'UPI', 'Bank Transfer', or 'Cheque'.
-- payout_note: Stores transaction IDs, reference numbers, or remarks.
