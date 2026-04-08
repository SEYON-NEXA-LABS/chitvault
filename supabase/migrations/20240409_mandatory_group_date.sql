-- Ensure start_date is not null for all groups to protect scheduling logic
UPDATE groups SET start_date = created_at::date WHERE start_date IS NULL;
ALTER TABLE groups ALTER COLUMN start_date SET NOT NULL;

-- Comment for traceability: 
-- This migration ensures that every group has a 'ground truth' date baseline 
-- for auction scheduling and dues calculation.
