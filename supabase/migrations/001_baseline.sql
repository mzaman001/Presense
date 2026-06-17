-- ============================================================
-- PRESENSE DATABASE SCHEMA v1.0
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================

-- 1. ITEMS (Do Space)
CREATE TABLE IF NOT EXISTS items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users NOT NULL,
  title                   text NOT NULL,
  first_step              text,
  ifthen_trigger          text,
  deadline                timestamptz,
  status                  text DEFAULT 'active' CHECK (status IN ('active','done','overdue','archived')),
  category                text DEFAULT 'other' CHECK (category IN ('work','study','personal','errand','health','other')),
  notification_sent_72h   boolean DEFAULT false,
  notification_sent_24h   boolean DEFAULT false,
  notification_sent_6h    boolean DEFAULT false,
  notification_sent_1h    boolean DEFAULT false,
  notification_sent_overdue boolean DEFAULT false,
  completed_at            timestamptz,
  created_at              timestamptz DEFAULT now()
);

-- 2. PEOPLE
CREATE TABLE IF NOT EXISTS people (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  name         text NOT NULL,
  relationship text DEFAULT 'other' CHECK (relationship IN ('friend','family','professor','colleague','other')),
  initials     text,
  color        text DEFAULT '#E5B41E',
  notes        jsonb[] DEFAULT '{}',
  last_seen    timestamptz,
  next_meeting timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- 3. THREADS (Think Space)
CREATE TABLE IF NOT EXISTS threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  title           text NOT NULL,
  color_accent    text DEFAULT '#2DD4BF',
  entries         jsonb[] DEFAULT '{}',
  stale_prompt    text,
  stale_prompt_at timestamptz,
  last_updated    timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- 4. EXPLORES
CREATE TABLE IF NOT EXISTS explores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  title        text NOT NULL,
  type         text DEFAULT 'other' CHECK (type IN ('link','quote','concept','book','other')),
  url          text,
  note         text NOT NULL DEFAULT '',
  tags         text[] DEFAULT '{}',
  saved_at     timestamptz DEFAULT now(),
  revisited_at timestamptz,
  digest_at    timestamptz
);

-- 5. LOCATIONS (Where I Put It)
CREATE TABLE IF NOT EXISTS locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  item_name     text NOT NULL,
  location_text text NOT NULL,
  photo_url     text,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

-- 6. PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth_key   text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- 7. USER SETTINGS
CREATE TABLE IF NOT EXISTS user_settings (
  user_id                uuid PRIMARY KEY REFERENCES auth.users,
  display_name           text,
  nudge_time             time DEFAULT '10:00:00',
  quiet_start            time DEFAULT '22:00:00',
  quiet_end              time DEFAULT '08:00:00',
  timezone               text DEFAULT 'Asia/Kolkata',
  notifications_enabled  boolean DEFAULT true,
  notif_72h              boolean DEFAULT true,
  notif_24h              boolean DEFAULT true,
  notif_6h               boolean DEFAULT true,
  notif_1h               boolean DEFAULT true,
  notif_overdue          boolean DEFAULT true,
  notif_briefing         boolean DEFAULT true,
  notif_stale_threads    boolean DEFAULT true,
  ollama_enabled         boolean DEFAULT false,
  ollama_url             text DEFAULT 'http://localhost:11434',
  reduce_motion          boolean DEFAULT false,
  ambient_bg             boolean DEFAULT true,
  created_at             timestamptz DEFAULT now()
);

-- Auto-create user_settings on first login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- ============================================================
-- ROW LEVEL SECURITY â€” Run AFTER 001_schema.sql
-- ============================================================

-- ITEMS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_items" ON items;
CREATE POLICY "users_own_items" ON items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PEOPLE
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_people" ON people;
CREATE POLICY "users_own_people" ON people FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- THREADS
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_threads" ON threads;
CREATE POLICY "users_own_threads" ON threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- EXPLORES
ALTER TABLE explores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_explores" ON explores;
CREATE POLICY "users_own_explores" ON explores FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- LOCATIONS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_locations" ON locations;
CREATE POLICY "users_own_locations" ON locations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PUSH_SUBSCRIPTIONS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_push_subs" ON push_subscriptions;
CREATE POLICY "users_own_push_subs" ON push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- USER_SETTINGS (user_id is PK so queries are auto-scoped)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_settings" ON user_settings;
CREATE POLICY "users_own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow realtime on items (for Home dashboard live counts)
-- ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS primary_struggles text[] DEFAULT '{}';
-- ============================================================
-- FULL-TEXT SEARCH INDEXES (pg_trgm) â€” Run AFTER 002_rls.sql
-- ============================================================

-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for fast fuzzy search on all searchable columns
CREATE INDEX IF NOT EXISTS idx_items_title        ON items     USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_first_step   ON items     USING GIN (first_step gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_people_name        ON people    USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_title      ON threads   USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_explores_title     ON explores  USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_explores_note      ON explores  USING GIN (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_item     ON locations USING GIN (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_loc      ON locations USING GIN (location_text gin_trgm_ops);

-- B-tree indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_items_user_status  ON items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_items_deadline     ON items (deadline);
CREATE INDEX IF NOT EXISTS idx_people_meeting     ON people (user_id, next_meeting);
CREATE INDEX IF NOT EXISTS idx_threads_updated    ON threads (user_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_explores_saved     ON explores (user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_explores_revisited ON explores (user_id, revisited_at);
CREATE INDEX IF NOT EXISTS idx_locations_updated  ON locations (user_id, updated_at DESC);
-- Add theme and color_mode columns to user_settings

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'orange' CHECK (theme IN ('orange','blue','forest')),
ADD COLUMN IF NOT EXISTS color_mode text DEFAULT 'dark' CHECK (color_mode IN ('dark','light'));
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
-- Add start_date and recurrence to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS start_date timestamptz;
ALTER TABLE items ADD COLUMN IF NOT EXISTS recurrence text;
-- Allow 'inbox' status on items table by dropping the old check constraint
-- In Supabase/PostgreSQL, we typically drop the constraint by name.
-- Since the exact generated name might vary if it was implicitly created, 
-- we will drop it. In 001_schema.sql it was created as:
-- status text DEFAULT 'active' CHECK (status IN ('active','done','overdue','archived'))

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('active','done','overdue','archived','inbox'));
-- Migration for Think Space
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
-- Migration for Think and Explore Spaces
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

ALTER TABLE public.explores
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS linked_thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL;
-- 1. Drop the check constraint on explores.type so users can use any string
ALTER TABLE explores DROP CONSTRAINT IF EXISTS explores_type_check;

-- 2. Add custom_types array to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS explore_custom_types text[] DEFAULT '{}';
-- Drop the check constraint on people.relationship so it can match task categories (work, study, personal, etc.)
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_relationship_check;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pomodoros_completed int DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pomodoro_duration int DEFAULT 10;
ALTER TABLE items ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS primary_struggles text[] DEFAULT '{}';
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#E5B41E',
ADD COLUMN IF NOT EXISTS short_break_duration int DEFAULT 5,
ADD COLUMN IF NOT EXISTS long_break_duration int DEFAULT 15,
ADD COLUMN IF NOT EXISTS auto_start_breaks boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS default_view text DEFAULT 'list',
ADD COLUMN IF NOT EXISTS auto_archive_days int DEFAULT 7,
ADD COLUMN IF NOT EXISTS custom_categories text[] DEFAULT '{"work","study","personal","errand","health","other"}',
ADD COLUMN IF NOT EXISTS smart_routing_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS confidence_threshold numeric DEFAULT 0.7;
ALTER TABLE people ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
ALTER TABLE explores DROP CONSTRAINT IF EXISTS explores_type_check;
-- 018_trash_system.sql
-- Add trash support (soft deletes) to items, explores, and threads as per V3 spec

-- 1. Items (Tasks)
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('active', 'done', 'inbox', 'deleted'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Explores
ALTER TABLE explores ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'deleted'));
ALTER TABLE explores ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. Threads (Think)
ALTER TABLE threads ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'deleted'));
ALTER TABLE threads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  task_id uuid REFERENCES items(id),
  duration_minutes int NOT NULL,
  type text NOT NULL CHECK (type IN ('work', 'short_break', 'long_break')),
  completed_at timestamptz DEFAULT now()
);
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS daily_briefing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pomodoro_sound boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_snooze boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS location_detection boolean DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark';
-- Add missing tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE threads, explores, people, locations;
-- Ensure all necessary columns exist for the new Settings page
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#E5B41E',
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'navy',
ADD COLUMN IF NOT EXISTS color_mode text DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS ambient_bg boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS reduce_motion boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS quiet_start time DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS quiet_end time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS daily_briefing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pomodoro_sound boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pomodoro_duration int DEFAULT 25,
ADD COLUMN IF NOT EXISTS short_break_duration int DEFAULT 5,
ADD COLUMN IF NOT EXISTS long_break_duration int DEFAULT 15,
ADD COLUMN IF NOT EXISTS auto_start_breaks boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS default_view text DEFAULT 'list',
ADD COLUMN IF NOT EXISTS auto_archive_days int DEFAULT 7,
ADD COLUMN IF NOT EXISTS do_categories text[] DEFAULT ARRAY['work','study','personal','errand','health'],
ADD COLUMN IF NOT EXISTS auto_snooze boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS smart_routing_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS nlp_date_parsing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS routing_confidence text DEFAULT 'Medium',
ADD COLUMN IF NOT EXISTS ollama_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ollama_url text DEFAULT 'http://localhost:11434',
ADD COLUMN IF NOT EXISTS location_detection boolean DEFAULT false;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pomodoro_long_break_interval int DEFAULT 4;


-- pg_cron configuration for edge functions
select cron.schedule('cleanup-trash', '0 2 * * *', "select net.http_post(url:='https://[PROJECT_REF].supabase.co/functions/v1/cron_cleanup', headers:='{\"Authorization\": \"Bearer [SERVICE_ROLE_KEY]\"}'::jsonb)");
select cron.schedule('recurrence-processor', '0 1 * * *', "select net.http_post(url:='https://[PROJECT_REF].supabase.co/functions/v1/cron_recurrence', headers:='{\"Authorization\": \"Bearer [SERVICE_ROLE_KEY]\"}'::jsonb)");
