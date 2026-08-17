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
DELETE FROM items
WHERE id NOT IN (
  SELECT first_id FROM (
    SELECT user_id, title, recurrence,
      min(created_at) AS first_created_at,
      min(id) AS first_id
    FROM items
    WHERE status = 'active' AND recurrence IS NOT NULL
    GROUP BY user_id, title, recurrence
  ) survivors
)
AND status = 'active' AND recurrence IS NOT NULL;

-- Step 2: the partial unique index. Status must be 'active' because only the
-- active window matters for recurrence seeding (done/trashed/archived rows
-- seed on completion and must not collide with the live task).
CREATE UNIQUE INDEX IF NOT EXISTS items_unique_active_recurring_idx
  ON items (user_id, title, recurrence)
  WHERE status = 'active';
