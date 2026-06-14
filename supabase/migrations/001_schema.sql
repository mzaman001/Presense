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
  color        text DEFAULT '#8B7CF8',
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
  notif_digest           boolean DEFAULT true,
  notif_stale_threads    boolean DEFAULT true,
  digest_enabled         boolean DEFAULT true,
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
