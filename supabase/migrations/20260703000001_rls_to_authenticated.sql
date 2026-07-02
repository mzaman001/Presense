DO $$
DECLARE
  t text;
  policy_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['items','people','threads','explores','locations','push_subscriptions','user_settings','categories','session_logs','ritual_logs'] LOOP
    policy_name := 'users_own_' || t;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = policy_name) THEN
      EXECUTE format('DROP POLICY %I ON %I', policy_name, t);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        policy_name, t
      );
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ritual_logs' AND policyname = 'Users can manage their own ritual logs'
  ) THEN
    DROP POLICY "Users can manage their own ritual logs" ON ritual_logs;
    CREATE POLICY users_own_ritual_logs ON ritual_logs
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
