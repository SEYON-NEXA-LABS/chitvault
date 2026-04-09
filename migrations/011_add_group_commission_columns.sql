-- Migration: 011_add_group_commission_columns.sql
-- Goal: Add storage for new commission rules to the groups table.

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS commission_type      text DEFAULT 'percent_of_payout',
ADD COLUMN IF NOT EXISTS commission_value     numeric(12,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS commission_recipient  text DEFAULT 'foreman';

-- Ensure the constraints are correct to keep data integrity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_comm_type_chk') THEN
    ALTER TABLE groups ADD CONSTRAINT groups_comm_type_chk 
    CHECK (commission_type IN ('percent_of_chit', 'percent_of_discount', 'percent_of_payout', 'fixed_amount'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_comm_recipient_chk') THEN
    ALTER TABLE groups ADD CONSTRAINT groups_comm_recipient_chk 
    CHECK (commission_recipient IN ('foreman', 'firm'));
  END IF;
END $$;
