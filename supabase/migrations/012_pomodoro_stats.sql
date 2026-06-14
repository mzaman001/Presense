ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pomodoros_completed int DEFAULT 0;
