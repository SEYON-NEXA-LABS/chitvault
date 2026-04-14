-- Migration: 016_dynamic_settlement_naming.sql
-- Goal: Rename legacy 'month_14_balance' column to a duration-neutral 'final_payout_amount'.

ALTER TABLE settlements RENAME COLUMN month_14_balance TO final_payout_amount;

-- Update comments or triggers if any (none found in recent audit)
COMMENT ON COLUMN settlements.final_payout_amount IS 'The calculated net payout for the member upon group closure or settlement.';
