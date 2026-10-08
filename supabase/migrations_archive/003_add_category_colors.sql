-- Add category color customization columns to user_settings
-- These support the CategoryManager color picker in SettingsModal

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS do_category_colors jsonb DEFAULT '{}';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS relationship_colors jsonb DEFAULT '{}';
