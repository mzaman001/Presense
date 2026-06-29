-- Migration: Add deleted_at to tables that support soft deletes
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE explores ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
