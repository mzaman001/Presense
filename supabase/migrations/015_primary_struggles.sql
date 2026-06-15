ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS primary_struggles text[] DEFAULT '{}';
