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

-- 6. Drop the now-dead relationship_colors column (added in
--    003_add_category_colors.sql for the removed People category-color
--    picker; unused now that people is gone).
ALTER TABLE user_settings DROP COLUMN IF EXISTS relationship_colors;

-- 7. Re-point public.rename_category(): the 'people_categories' branch
--    wrote user_settings.people_categories, user_settings.relationship_colors,
--    and people.relationship, all three now dropped. Remove that branch so an
--    unrecognized p_categories_key (including the now-invalid
--    'people_categories') falls through to the existing
--    "RAISE EXCEPTION 'Invalid categories key'" instead of erroring on
--    dropped objects. Signature, SECURITY DEFINER, search_path, the
--    do_categories branch, and the auth/validation checks are unchanged.
--    CREATE OR REPLACE FUNCTION preserves existing grants automatically; no
--    prior migration re-grants after replacing this function (the secperf
--    migration's GRANT EXECUTE was a standalone REVOKE/GRANT, not paired
--    with a CREATE OR REPLACE), so none is added here.
CREATE OR REPLACE FUNCTION public.rename_category(
  p_categories_key text,
  p_colors_key text,
  p_old_category text,
  p_new_category text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_old_category)) < 1 OR length(p_old_category) > 50 THEN
    RAISE EXCEPTION 'Invalid old category name';
  END IF;

  IF length(trim(p_new_category)) < 1 OR length(p_new_category) > 50 THEN
    RAISE EXCEPTION 'Invalid new category name';
  END IF;

  IF p_categories_key = 'do_categories' THEN
    UPDATE public.user_settings
    SET
      do_categories = array_replace(do_categories, p_old_category, p_new_category),
      do_category_colors = CASE
        WHEN do_category_colors ? p_old_category THEN
          (do_category_colors - p_old_category) || jsonb_build_object(p_new_category, do_category_colors->p_old_category)
        ELSE
          do_category_colors
      END
    WHERE user_id = v_user_id;

    UPDATE public.items
    SET category = p_new_category
    WHERE user_id = v_user_id
      AND category = p_old_category;

  ELSE
    RAISE EXCEPTION 'Invalid categories key: %', p_categories_key;
  END IF;
END;
$$;
