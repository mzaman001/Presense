-- Add unique constraint on (user_id, title) for threads to prevent duplicate daily notes
-- This prevents the TOCTOU race condition where concurrent requests both see
-- "no existing thread" and both insert, creating duplicates.

CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_user_title_unique
  ON threads (user_id, title)
  WHERE status != 'deleted';
