-- 1. Drop existing check constraints immediately to allow updates
ALTER TABLE "public"."groups"
  DROP CONSTRAINT IF EXISTS groups_auction_scheme_check,
  DROP CONSTRAINT IF EXISTS groups_scheme_chk;

-- 2. Safely convert column to TEXT with USING clause to handle custom ENUMs perfectly
ALTER TABLE "public"."groups"
  ALTER COLUMN "auction_scheme" TYPE TEXT USING "auction_scheme"::text;

-- 3. Update existing 'DIVIDEND' schemes in groups table to 'DIVIDEND_SHARE'
UPDATE "public"."groups"
SET "auction_scheme" = 'DIVIDEND_SHARE'
WHERE "auction_scheme" = 'DIVIDEND';

-- 4. Update existing 'DIVIDEND' schemes in the firms' enabled_schemes array
UPDATE "public"."firms"
SET "enabled_schemes" = array_replace("enabled_schemes", 'DIVIDEND', 'DIVIDEND_SHARE')
WHERE 'DIVIDEND' = ANY("enabled_schemes");

-- 5. Add the new comprehensive check constraint covering all 8 schemes
ALTER TABLE "public"."groups"
  ADD CONSTRAINT groups_auction_scheme_check 
  CHECK (auction_scheme IN (
    'DIVIDEND_SHARE',
    'ACCUMULATION',
    'LOTTERY',
    'FIXED_ROTATION',
    'SEALED_TENDER',
    'BOUNDED_AUCTION',
    'HYBRID_SPLIT',
    'STEPPED_INSTALLMENT'
  ));

-- 6. Add new columns for advanced hybrid and escalating schemes
ALTER TABLE "public"."groups"
  ADD COLUMN IF NOT EXISTS "dividend_split_pct" NUMERIC(5,4) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "surplus_split_pct" NUMERIC(5,4) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "step_amount" NUMERIC(10,2) DEFAULT 0;

