-- Add ritual settings fields to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS last_ritual_date DATE,
ADD COLUMN IF NOT EXISTS shutdown_time TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS daily_capacity_minutes INTEGER DEFAULT 240;

-- Add time_estimate field to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS time_estimate INTEGER DEFAULT 0;
