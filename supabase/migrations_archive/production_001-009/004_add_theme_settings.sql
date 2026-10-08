-- Add theme and color_mode columns to user_settings

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'orange' CHECK (theme IN ('orange','blue','forest')),
ADD COLUMN IF NOT EXISTS color_mode text DEFAULT 'dark' CHECK (color_mode IN ('dark','light'));
