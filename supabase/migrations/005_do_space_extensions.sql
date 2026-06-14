-- Add priority and subtasks to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS priority int DEFAULT 4;
ALTER TABLE items ADD COLUMN IF NOT EXISTS subtasks jsonb[] DEFAULT '{}';

-- Custom categories table
CREATE TABLE IF NOT EXISTS categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  name         text NOT NULL,
  color        text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- We need to drop the constraint on items category to allow custom categories, or keep it and say custom categories are stored differently?
-- The plan says "Default categories: Work, Study, Personal, Errand, Health. A "+ Add category" option at the bottom... Stored in a categories table per user. Applied as coloured pills on task cards."
-- So we drop the check constraint on items.category.
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_category_check;
