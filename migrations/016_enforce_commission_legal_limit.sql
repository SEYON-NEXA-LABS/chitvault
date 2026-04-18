-- Migration: 016_enforce_commission_legal_limit.sql (Auto-Capping)
-- Goal: Enforce a legal maximum of 5% on foreman commissions.

-- 1. Auto-Cap existing groups to ensure compliance and allow constraint application
UPDATE public.groups
SET commission_value = 5.00
WHERE commission_type IN ('percent_of_chit', 'percent_of_discount', 'percent_of_payout')
  AND commission_value > 5.00;

UPDATE public.groups
SET commission_value = (chit_value * 0.05)
WHERE commission_type = 'fixed_amount'
  AND commission_value > (chit_value * 0.05);

-- 2. Add the hard check constraint
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_comm_limit_chk;
ALTER TABLE public.groups ADD CONSTRAINT groups_comm_limit_chk CHECK (
  (commission_type IN ('percent_of_chit', 'percent_of_discount', 'percent_of_payout') AND commission_value <= 5.00) OR
  (commission_type = 'fixed_amount' AND commission_value <= (chit_value * 0.05 + 0.01)) -- Allowed for rounding
);

-- 3. Comment on the constraint for future administrators
COMMENT ON COLUMN public.groups.commission_value IS 'Foreman commission. Capped at 5% of chit_value by legal mandate.';
