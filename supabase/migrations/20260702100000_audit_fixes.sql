-- Audit fix migration: security hardening, type consistency, indexes
-- Applied: 2026-07-02

-- ============================================================
-- M2: SECURITY DEFINER search_path hardening
-- Prevents search_path injection attacks on all RPC functions
-- Note: increment_pomodoro_count was dropped in 007, only 3
-- functions remain: handle_new_user, increment_time_spent, rename_category
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    ALTER FUNCTION public.handle_new_user()
      SET search_path = pg_catalog, public;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'increment_time_spent'
  ) THEN
    ALTER FUNCTION public.increment_time_spent()
      SET search_path = pg_catalog, public;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rename_category'
  ) THEN
    ALTER FUNCTION public.rename_category(
      p_categories_key text,
      p_colors_key text,
      p_old_category text,
      p_new_category text
    )
      SET search_path = pg_catalog, public;
  END IF;
END $$;

-- ============================================================
-- M5: Fix last_evening_ritual_date type mismatch (TEXT → DATE)
-- The column was created as TEXT in 20260628121249 but should be
-- DATE like last_ritual_date (created in 20260629095300)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings'
      AND column_name = 'last_evening_ritual_date'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE user_settings
      ALTER COLUMN last_evening_ritual_date
      TYPE DATE
      USING last_evening_ritual_date::DATE;
  END IF;
END $$;

-- ============================================================
-- m4: CHECK constraint on explores.type
-- Ensures only valid type values are stored
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'explores_type_check'
  ) THEN
    ALTER TABLE explores
      ADD CONSTRAINT explores_type_check
      CHECK (type IN ('link','note','book','quote','concept','other'));
  END IF;
END $$;

-- ============================================================
-- A1: PostgREST auto schema cache reload
-- Fires after every DDL change so PostgREST never serves stale schema
-- ============================================================
CREATE OR REPLACE FUNCTION public.pgrst_watch()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

DROP EVENT TRIGGER IF EXISTS pgrst_watch;
CREATE EVENT TRIGGER pgrst_watch
  ON ddl_command_end
  EXECUTE PROCEDURE public.pgrst_watch();

-- ============================================================
-- A3: Partial indexes for soft-deleted tables
-- Speeds up queries that filter WHERE deleted_at IS NULL
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_items_active
  ON items (user_id, deadline)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_threads_active
  ON threads (user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_explores_active
  ON explores (user_id, type)
  WHERE deleted_at IS NULL;
