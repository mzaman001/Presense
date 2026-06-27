ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS people_categories text[] 
  DEFAULT ARRAY['friend', 'family', 'professor', 'colleague', 'teammate', 'other'];
