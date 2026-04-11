-- ChitVault Migration: Add Soft-Delete (deleted_at) columns
-- To be run in Supabase SQL Editor

ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Refresh RPCs to ensure they can access the new columns
-- (The RPC code in performance_rpcs.sql already references these columns)
