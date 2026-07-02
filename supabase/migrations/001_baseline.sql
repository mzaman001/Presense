-- ============================================================
-- PRESENSE DATABASE SCHEMA v1.0
-- Consolidated Baseline Migration
-- ============================================================

-- 1. ITEMS (Do Space)
CREATE TABLE IF NOT EXISTS items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users NOT NULL,
  title                   text NOT NULL,
  first_step              text,
  ifthen_trigger          text,
  notes                   text,
  deadline                timestamptz,
  start_date              timestamptz,
  status                  text DEFAULT 'active' CHECK (status IN ('active','done','inbox','overdue','archived','deleted')),
  category                text DEFAULT 'other',
  priority                int DEFAULT 4,
  subtasks                jsonb[] DEFAULT '{}',
  recurrence              text,
  snoozed_until           timestamptz,
  notification_sent_72h   boolean DEFAULT false,
  notification_sent_24h   boolean DEFAULT false,
  notification_sent_6h    boolean DEFAULT false,
  notification_sent_1h    boolean DEFAULT false,
  notification_sent_overdue boolean DEFAULT false,
  completed_at            timestamptz,
  deleted_at              timestamptz,
  created_at              timestamptz DEFAULT now()
);

-- 2. PEOPLE
CREATE TABLE IF NOT EXISTS people (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  name         text NOT NULL,
  relationship text DEFAULT 'other',
  initials     text,
  color        text DEFAULT '#E5B41E',
  notes        jsonb[] DEFAULT '{}',
  sort_order   int DEFAULT 0,
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
  status          text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  is_pinned       boolean DEFAULT false,
  stale_prompt    text,
  stale_prompt_at timestamptz,
  last_updated    timestamptz DEFAULT now(),
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- 4. EXPLORES
CREATE TABLE IF NOT EXISTS explores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users NOT NULL,
  title            text NOT NULL,
  type             text DEFAULT 'other',
  url              text,
  note             text NOT NULL DEFAULT '',
  tags             text[] DEFAULT '{}',
  status           text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  linked_thread_id uuid REFERENCES threads(id) ON DELETE SET NULL,
  saved_at         timestamptz DEFAULT now(),
  revisited_at     timestamptz,
  digest_at        timestamptz,
  deleted_at       timestamptz
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
  timezone               text DEFAULT 'UTC',
  theme                  text DEFAULT 'wahala',
  color_mode             text DEFAULT 'dark',
  avatar_color           text DEFAULT '#E5B41E',
  ambient_bg             boolean DEFAULT true,
  reduce_motion          boolean DEFAULT false,
  default_view           text DEFAULT 'list',
  
  notifications_enabled  boolean DEFAULT true,
  notif_72h              boolean DEFAULT true,
  notif_24h              boolean DEFAULT true,
  notif_6h               boolean DEFAULT true,
  notif_1h               boolean DEFAULT true,
  notif_overdue          boolean DEFAULT true,
  notif_briefing         boolean DEFAULT true,
  notif_stale_threads    boolean DEFAULT true,
  
  daily_briefing         boolean DEFAULT true,
  auto_snooze            boolean DEFAULT false,
  auto_archive_days      int DEFAULT 7,
  location_detection     boolean DEFAULT false,
  
  pomodoro_sound         boolean DEFAULT true,
  pomodoro_duration      int DEFAULT 25,
  short_break_duration   int DEFAULT 5,
  long_break_duration    int DEFAULT 15,
  pomodoro_long_break_interval int DEFAULT 4,
  auto_start_breaks      boolean DEFAULT false,
  pomodoros_completed    int DEFAULT 0,
  
  smart_routing_enabled  boolean DEFAULT true,
  nlp_date_parsing       boolean DEFAULT true,
  routing_confidence     text DEFAULT 'Medium',
  confidence_threshold   numeric DEFAULT 0.7,
  ollama_enabled         boolean DEFAULT false,
  ollama_url             text DEFAULT 'http://localhost:11434',
  
  onboarding_complete    boolean DEFAULT false,
  primary_struggles      text[] DEFAULT '{}',
  do_categories          text[] DEFAULT ARRAY['work','study','personal','errand','health'],
  explore_custom_types   text[] DEFAULT '{}',
  
  created_at             timestamptz DEFAULT now()
);

-- 8. CUSTOM CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  name         text NOT NULL,
  color        text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- 9. SESSION LOGS
CREATE TABLE IF NOT EXISTS session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  task_id uuid REFERENCES items(id),
  duration_minutes int NOT NULL,
  type text NOT NULL CHECK (type IN ('work', 'short_break', 'long_break')),
  completed_at timestamptz DEFAULT now()
);

-- Auto-create user_settings on first login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, display_name)
  VALUES (NEW.id, left(NEW.raw_user_meta_data->>'full_name', 100))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_items" ON items;
CREATE POLICY "users_own_items" ON items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_people" ON people;
CREATE POLICY "users_own_people" ON people FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_threads" ON threads;
CREATE POLICY "users_own_threads" ON threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE explores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_explores" ON explores;
CREATE POLICY "users_own_explores" ON explores FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_locations" ON locations;
CREATE POLICY "users_own_locations" ON locations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_push_subs" ON push_subscriptions;
CREATE POLICY "users_own_push_subs" ON push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_settings" ON user_settings;
CREATE POLICY "users_own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_categories" ON categories;
CREATE POLICY "users_own_categories" ON categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_session_logs" ON session_logs;
CREATE POLICY "users_own_session_logs" ON session_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE items, threads, explores, people, locations;

-- ============================================================
-- FULL-TEXT SEARCH INDEXES (pg_trgm)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_items_title        ON items     USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_first_step   ON items     USING GIN (first_step gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_people_name        ON people    USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_title      ON threads   USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_explores_title     ON explores  USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_explores_note      ON explores  USING GIN (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_item     ON locations USING GIN (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_loc      ON locations USING GIN (location_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_items_user_status  ON items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_items_deadline     ON items (deadline);
CREATE INDEX IF NOT EXISTS idx_people_meeting     ON people (user_id, next_meeting);
CREATE INDEX IF NOT EXISTS idx_threads_updated    ON threads (user_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_explores_saved     ON explores (user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_explores_revisited ON explores (user_id, revisited_at);
CREATE INDEX IF NOT EXISTS idx_locations_updated  ON locations (user_id, updated_at DESC);
