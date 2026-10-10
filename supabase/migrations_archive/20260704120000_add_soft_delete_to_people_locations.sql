-- Migration: Add soft-delete support to people and locations tables
-- People: add status + deleted_at columns
ALTER TABLE people ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_status_check;
ALTER TABLE people ADD CONSTRAINT people_status_check CHECK (status IN ('active', 'deleted'));
ALTER TABLE people ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Locations: add status + deleted_at columns  
ALTER TABLE locations ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_status_check;
ALTER TABLE locations ADD CONSTRAINT locations_status_check CHECK (status IN ('active', 'deleted'));
ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
