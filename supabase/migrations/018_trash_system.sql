-- 018_trash_system.sql
-- Add trash support (soft deletes) to items, explores, and threads as per V3 spec

-- 1. Items (Tasks)
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('active', 'done', 'inbox', 'deleted'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Explores
ALTER TABLE explores ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'deleted'));
ALTER TABLE explores ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. Threads (Think)
ALTER TABLE threads ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'deleted'));
ALTER TABLE threads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
