-- Add enabled_schemes to firms table
ALTER TABLE firms ADD COLUMN IF NOT EXISTS enabled_schemes text[] DEFAULT ARRAY['DIVIDEND', 'ACCUMULATION'];

-- Update existing firms to have both models by default
UPDATE firms SET enabled_schemes = ARRAY['DIVIDEND', 'ACCUMULATION'] WHERE enabled_schemes IS NULL;

-- Add a comment for better documentation
COMMENT ON COLUMN firms.enabled_schemes IS 'List of active auction schemes for this firm (DIVIDEND, ACCUMULATION)';
