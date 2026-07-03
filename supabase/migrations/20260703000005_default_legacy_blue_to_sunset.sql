-- Make Sunset the first-run/default experience for legacy blue users too.

UPDATE public.user_settings
SET theme = 'sunset'
WHERE theme IN ('blue', 'navy', 'midnight');

ALTER TABLE public.user_settings
  ALTER COLUMN theme SET DEFAULT 'sunset';

NOTIFY pgrst, 'reload schema';

