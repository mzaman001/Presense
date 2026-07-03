-- Rename theme ids from legacy labels to stable product names.
-- Drop/replace the CHECK constraint before updating rows to new values.

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_theme_check
  CHECK (theme IN ('sunset', 'midnight', 'meadow', 'wahala', 'orange', 'blue', 'forest'));

UPDATE public.user_settings
SET theme = CASE theme
  WHEN 'wahala' THEN 'sunset'
  WHEN 'orange' THEN 'sunset'
  WHEN 'blue' THEN 'midnight'
  WHEN 'forest' THEN 'meadow'
  ELSE theme
END
WHERE theme IN ('wahala', 'orange', 'blue', 'forest');

ALTER TABLE public.user_settings
  ALTER COLUMN theme SET DEFAULT 'sunset';

NOTIFY pgrst, 'reload schema';
