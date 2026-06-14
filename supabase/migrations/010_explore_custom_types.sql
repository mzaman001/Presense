-- 1. Drop the check constraint on explores.type so users can use any string
ALTER TABLE explores DROP CONSTRAINT IF EXISTS explores_type_check;

-- 2. Add custom_types array to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS explore_custom_types text[] DEFAULT '{}';
