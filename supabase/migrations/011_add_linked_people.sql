-- Migration: Add linked_people to items and threads tables
ALTER TABLE items ADD COLUMN IF NOT EXISTS linked_people uuid[] DEFAULT '{}';
ALTER TABLE threads ADD COLUMN IF NOT EXISTS linked_people uuid[] DEFAULT '{}';

-- Create GIN indexes for fast querying on array columns
CREATE INDEX IF NOT EXISTS idx_items_linked_people ON items USING gin (linked_people);
CREATE INDEX IF NOT EXISTS idx_threads_linked_people ON threads USING gin (linked_people);
