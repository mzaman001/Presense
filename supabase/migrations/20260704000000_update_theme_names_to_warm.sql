-- Rename theme ids from legacy labels to new canonical names.
-- Drop/replace the CHECK constraint before updating rows to new values.

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_theme_check
  CHECK (theme IN ('warm', 'navy', 'forest', 'sunset', 'midnight', 'meadow', 'wahala', 'orange', 'blue'));

UPDATE public.user_settings
SET theme = CASE theme
  WHEN 'sunset' THEN 'warm'
  WHEN 'wahala' THEN 'warm'
  WHEN 'orange' THEN 'warm'
  WHEN 'midnight' THEN 'navy'
  WHEN 'blue' THEN 'navy'
  WHEN 'meadow' THEN 'forest'
  ELSE theme
END
WHERE theme IN ('sunset', 'wahala', 'orange', 'midnight', 'blue', 'meadow');

ALTER TABLE public.user_settings
  ALTER COLUMN theme SET DEFAULT 'warm';

NOTIFY pgrst, 'reload schema';
