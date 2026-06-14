-- Drop the check constraint on people.relationship so it can match task categories (work, study, personal, etc.)
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_relationship_check;
