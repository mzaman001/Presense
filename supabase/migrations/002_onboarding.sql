ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS primary_struggles text[] DEFAULT '{}';
