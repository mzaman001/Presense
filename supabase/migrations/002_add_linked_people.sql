-- Add linked_people_ids to items table to connect tasks with people
ALTER TABLE items ADD COLUMN IF NOT EXISTS linked_people_ids uuid[] DEFAULT '{}';
