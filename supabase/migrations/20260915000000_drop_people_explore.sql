-- Drop the people and explores tables (and everything that exists only to
-- support them) as part of removing the Explore and People features from
-- the app. Confirmed by the user: full removal, no export/migration path
-- for existing data in these tables.
-- Invariant-change-approved-by: user / 2026-09-15

-- 1. Drop the trigger and function that kept items/threads' linked_people_ids
--    in sync with people deletions — meaningless once people is gone.
DROP TRIGGER IF EXISTS trigger_remove_linked_person ON people;
DROP FUNCTION IF EXISTS remove_linked_person();

-- 2. Drop the linked_people_ids columns (and their GIN indexes) from items
--    and threads — the "Linked People" feature is removed from the app.
DROP INDEX IF EXISTS idx_items_linked_people_ids;
DROP INDEX IF EXISTS idx_threads_linked_people_ids;
ALTER TABLE items DROP COLUMN IF EXISTS linked_people_ids;
ALTER TABLE threads DROP COLUMN IF EXISTS linked_people_ids;

-- 3. Drop the now-dead user_settings columns.
ALTER TABLE user_settings DROP COLUMN IF EXISTS people_categories;
ALTER TABLE user_settings DROP COLUMN IF EXISTS explore_custom_types;

-- 4. Drop explores' and people's own indexes before dropping the tables
--    (belt and braces — DROP TABLE would take them with the table
--    regardless). RLS policies ("users_own_people", etc.) are dropped
--    automatically with their tables, no explicit DROP POLICY needed.
DROP INDEX IF EXISTS idx_explores_linked_thread_id;
DROP INDEX IF EXISTS idx_explores_active;
DROP INDEX IF EXISTS idx_explores_title;
DROP INDEX IF EXISTS idx_explores_note;
DROP INDEX IF EXISTS idx_explores_saved;
DROP INDEX IF EXISTS idx_explores_revisited;
DROP INDEX IF EXISTS idx_people_name;
DROP INDEX IF EXISTS idx_people_meeting;

-- 5. Drop the tables themselves. explores.linked_thread_id -> threads.id
--    and both tables' user_id -> auth.users FKs go with them.
DROP TABLE IF EXISTS explores;
DROP TABLE IF EXISTS people;
