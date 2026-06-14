-- Migration for Think and Explore Spaces
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

ALTER TABLE public.explores
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS linked_thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL;
