-- INFRA-23 (Aug 17, 2026): recurring-task deduplication at the database level.
--
-- Problem: `cron_recurrence` did a check-then-insert (maybeSingle + insert),
-- so overlapping invocations (retry, manual trigger) could create duplicate
-- recurring tasks. The function now inserts directly and treats a
-- unique-violation as success — but that only works once a unique index
-- exists to violate against.
--
-- Step 1: remove any rows that would block index creation. For each
-- (user_id, title, recurrence) group among active recurring rows, keep the
-- oldest row by created_at and permanently delete the rest (they are exact
-- duplicates from previous race windows).
-- `min(id)` on a uuid column has no aggregate defined in Postgres, and even
-- if it did, an independent min(id) doesn't identify "the row with the
-- earliest created_at" — it just picks whichever id sorts lowest, unrelated
-- to created_at. DISTINCT ON correctly returns the actual id belonging to
-- the earliest-created row per group (ties broken by id for determinism).
DELETE FROM items
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, title, recurrence) id
  FROM items
  WHERE status = 'active' AND recurrence IS NOT NULL
  ORDER BY user_id, title, recurrence, created_at ASC, id ASC
)
AND status = 'active' AND recurrence IS NOT NULL;

-- Step 2: the partial unique index. Status must be 'active' because only the
-- active window matters for recurrence seeding (done/trashed/archived rows
-- seed on completion and must not collide with the live task).
CREATE UNIQUE INDEX IF NOT EXISTS items_unique_active_recurring_idx
  ON items (user_id, title, recurrence)
  WHERE status = 'active';
