-- ============================================================
-- FULL-TEXT SEARCH INDEXES (pg_trgm) — Run AFTER 002_rls.sql
-- ============================================================

-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for fast fuzzy search on all searchable columns
CREATE INDEX IF NOT EXISTS idx_items_title        ON items     USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_first_step   ON items     USING GIN (first_step gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_people_name        ON people    USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_title      ON threads   USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_explores_title     ON explores  USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_explores_note      ON explores  USING GIN (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_item     ON locations USING GIN (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_loc      ON locations USING GIN (location_text gin_trgm_ops);

-- B-tree indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_items_user_status  ON items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_items_deadline     ON items (deadline);
CREATE INDEX IF NOT EXISTS idx_people_meeting     ON people (user_id, next_meeting);
CREATE INDEX IF NOT EXISTS idx_threads_updated    ON threads (user_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_explores_saved     ON explores (user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_explores_revisited ON explores (user_id, revisited_at);
CREATE INDEX IF NOT EXISTS idx_locations_updated  ON locations (user_id, updated_at DESC);
