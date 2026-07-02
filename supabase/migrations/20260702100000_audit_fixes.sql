-- Audit fix migration: security hardening, type consistency, indexes
-- Applied: 2026-07-02

-- ============================================================
-- M2: SECURITY DEFINER search_path hardening
-- Prevents search_path injection attacks on all 4 RPC functions
-- ============================================================
ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.increment_pomodoro_count()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.increment_time_spent()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.rename_category(
  p_user_id uuid,
  p_old_name text,
  p_new_name text
)
  SET search_path = pg_catalog, public;

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
