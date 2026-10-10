-- Migrate existing data from linked_people to linked_people_ids
-- linked_people_ids is the canonical column (has GIN index, has cleanup trigger coverage)

-- Add linked_people_ids to threads if it doesn't exist
ALTER TABLE threads ADD COLUMN IF NOT EXISTS linked_people_ids uuid[] DEFAULT '{}';

-- Migrate items
UPDATE items
SET linked_people_ids = COALESCE(linked_people, '{}')
WHERE linked_people IS NOT NULL
  AND (linked_people_ids IS NULL OR linked_people_ids = '{}');

-- Migrate threads
UPDATE threads
SET linked_people_ids = COALESCE(linked_people, '{}')
WHERE linked_people IS NOT NULL
  AND (linked_people_ids IS NULL OR linked_people_ids = '{}');

-- Drop the redundant linked_people columns
ALTER TABLE items DROP COLUMN IF EXISTS linked_people;
ALTER TABLE threads DROP COLUMN IF EXISTS linked_people;
