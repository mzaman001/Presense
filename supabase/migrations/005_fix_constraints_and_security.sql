-- ============================================================
-- FIX 005: Fix CHECK constraints, auth, and schema cleanup
-- ============================================================

-- 1. Fix items status CHECK — add overdue and archived
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check
  CHECK (status IN ('active', 'done', 'overdue', 'archived', 'inbox', 'deleted'));

-- 2. Fix explores status CHECK — add archived
ALTER TABLE explores DROP CONSTRAINT IF EXISTS explores_status_check;
ALTER TABLE explores ADD CONSTRAINT explores_status_check
  CHECK (status IN ('active', 'archived', 'deleted'));

-- 3. Fix threads status CHECK — add archived
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_status_check;
ALTER TABLE threads ADD CONSTRAINT threads_status_check
  CHECK (status IN ('active', 'archived', 'deleted'));

-- 4. Normalize theme default (migration 001 added it twice with different defaults)
ALTER TABLE user_settings ALTER COLUMN theme SET DEFAULT 'wahala';

-- 5. Normalize avatar_color default (added twice in 001)
ALTER TABLE user_settings ALTER COLUMN avatar_color SET DEFAULT '#E5B41E';
