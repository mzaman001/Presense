ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#E5B41E',
ADD COLUMN IF NOT EXISTS short_break_duration int DEFAULT 5,
ADD COLUMN IF NOT EXISTS long_break_duration int DEFAULT 15,
ADD COLUMN IF NOT EXISTS auto_start_breaks boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS default_view text DEFAULT 'list',
ADD COLUMN IF NOT EXISTS auto_archive_days int DEFAULT 7,
ADD COLUMN IF NOT EXISTS custom_categories text[] DEFAULT '{"work","study","personal","errand","health","other"}',
ADD COLUMN IF NOT EXISTS smart_routing_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS confidence_threshold numeric DEFAULT 0.7;
