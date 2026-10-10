-- Add start_date and recurrence to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS start_date timestamptz;
ALTER TABLE items ADD COLUMN IF NOT EXISTS recurrence text;
