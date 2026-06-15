ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS daily_briefing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pomodoro_sound boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_snooze boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS location_detection boolean DEFAULT false;
