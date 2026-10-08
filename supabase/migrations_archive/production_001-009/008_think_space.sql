-- Migration for Think Space
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
