-- Drop ritual_streak column from user_settings.
-- CONF-17 resolved against gamification; the app no longer writes or reads
-- this column (see RitualOverlay.tsx and Home dashboard ritual badge).
-- Invariant-change-approved-by: user / 2026-07-31
ALTER TABLE user_settings DROP COLUMN IF EXISTS ritual_streak;
