-- Migration: 034_update_dividend_strategy_names.sql
-- Goal: Rename legacy dividend_strategy values to new enum names.

-- Convert old 'professional' (winner pays, N-1) to the new 'pro_n1' identifier.
-- Any groups that still have the deprecated value will be updated.

BEGIN;

UPDATE public.groups
SET dividend_strategy = 'pro_n1'
WHERE dividend_strategy = 'professional';

-- Optional: ensure any NULL values fall back to the system default ('pro_n').
UPDATE public.groups
SET dividend_strategy = 'pro_n'
WHERE dividend_strategy IS NULL;

COMMIT;
