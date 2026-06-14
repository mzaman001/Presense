-- Allow 'inbox' status on items table by dropping the old check constraint
-- In Supabase/PostgreSQL, we typically drop the constraint by name.
-- Since the exact generated name might vary if it was implicitly created, 
-- we will drop it. In 001_schema.sql it was created as:
-- status text DEFAULT 'active' CHECK (status IN ('active','done','overdue','archived'))

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('active','done','overdue','archived','inbox'));
