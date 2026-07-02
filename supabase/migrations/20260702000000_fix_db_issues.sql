-- ============================================================
-- FIX: Database issues from audit
-- ============================================================

-- 1. Fix cleanup trigger: remove references to dropped linked_people column
CREATE OR REPLACE FUNCTION remove_linked_person()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove the person ID from items (only linked_people_ids remains)
  UPDATE items
  SET linked_people_ids = array_remove(linked_people_ids, OLD.id)
  WHERE OLD.id = ANY(linked_people_ids);

  -- Remove the person ID from threads (only linked_people_ids remains)
  UPDATE threads
  SET linked_people_ids = array_remove(linked_people_ids, OLD.id)
  WHERE OLD.id = ANY(linked_people_ids);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. Add ON DELETE CASCADE to all auth.users foreign keys
-- (Cannot ALTER existing FK constraints in PostgreSQL, must recreate tables)
-- Using a DO block to safely alter each table

-- items
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE items ADD CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- people
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_user_id_fkey;
ALTER TABLE people ADD CONSTRAINT people_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- threads
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_user_id_fkey;
ALTER TABLE threads ADD CONSTRAINT threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- explores
ALTER TABLE explores DROP CONSTRAINT IF EXISTS explores_user_id_fkey;
ALTER TABLE explores ADD CONSTRAINT explores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- locations
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_user_id_fkey;
ALTER TABLE locations ADD CONSTRAINT locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- push_subscriptions
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- user_settings
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- categories
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- session_logs
ALTER TABLE session_logs DROP CONSTRAINT IF EXISTS session_logs_user_id_fkey;
ALTER TABLE session_logs ADD CONSTRAINT session_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users ON DELETE CASCADE;

-- 3. Add GIN index on linked_people_ids for efficient contains queries
CREATE INDEX IF NOT EXISTS idx_items_linked_people_ids ON items USING GIN (linked_people_ids);
CREATE INDEX IF NOT EXISTS idx_threads_linked_people_ids ON threads USING GIN (linked_people_ids);

-- 4. Add missing indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_session_logs_user_completed ON session_logs (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ritual_logs_user_completed ON ritual_logs (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
