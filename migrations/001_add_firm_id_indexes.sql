-- Optimization for Multi-Tenancy: Add B-Tree Indexes on firm_id
-- Run this in the Supabase SQL Editor

-- 1. Core Profile & Firm linking
CREATE INDEX IF NOT EXISTS idx_profiles_firm_id ON public.profiles (firm_id);

-- 2. CRM & Enrollment
CREATE INDEX IF NOT EXISTS idx_persons_firm_id ON public.persons (firm_id);
CREATE INDEX IF NOT EXISTS idx_members_firm_id ON public.members (firm_id);

-- 3. Business Structure
CREATE INDEX IF NOT EXISTS idx_groups_firm_id ON public.groups (firm_id);

-- 4. Ledgers & Operations
CREATE INDEX IF NOT EXISTS idx_auctions_firm_id ON public.auctions (firm_id);
CREATE INDEX IF NOT EXISTS idx_payments_firm_id ON public.payments (firm_id);
CREATE INDEX IF NOT EXISTS idx_denominations_firm_id ON public.denominations (firm_id);

-- 5. Financial Calculations & Commissions
CREATE INDEX IF NOT EXISTS idx_foreman_commissions_firm_id ON public.foreman_commissions (firm_id);

-- 6. Platform Logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_firm_id ON public.activity_logs (firm_id);

-- Informational: This allows efficient lookups for single firm views (WHERE firm_id = '...')
-- and fast joins across tables for large scale monitoring.
