-- ============================================================
-- ROW LEVEL SECURITY — Run AFTER 001_schema.sql
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
