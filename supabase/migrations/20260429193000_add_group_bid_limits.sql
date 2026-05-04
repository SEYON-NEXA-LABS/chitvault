-- Add missing bidding limit columns to groups table
 ALTER TABLE "public"."groups"
   ADD COLUMN IF NOT EXISTS "min_bid_pct" NUMERIC(12,4) DEFAULT 0.0500,
   ADD COLUMN IF NOT EXISTS "max_bid_pct" NUMERIC(12,4) DEFAULT 0.4000,
   ADD COLUMN IF NOT EXISTS "discount_cap_pct" NUMERIC(12,4) DEFAULT 0.4000;
 
 -- Update existing rows if they are NULL (though DEFAULT should handle new inserts)
 UPDATE "public"."groups" SET "min_bid_pct" = 0.0500 WHERE "min_bid_pct" IS NULL;
 UPDATE "public"."groups" SET "max_bid_pct" = 0.4000 WHERE "max_bid_pct" IS NULL;
 UPDATE "public"."groups" SET "discount_cap_pct" = 0.4000 WHERE "discount_cap_pct" IS NULL;
