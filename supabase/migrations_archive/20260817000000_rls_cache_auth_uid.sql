-- INFRA-15: wrap bare auth.uid() in RLS policy expressions with a row-independent
-- subquery so Postgres evaluates the volatile function once (initPlan) instead
-- of once per scanned row. The permitted row set is identical to the old
-- policies — only the evaluation cost changes.
-- See supabase/migrations/20260703000001_rls_to_authenticated.sql for the
-- authoritative live policy inventory (users_own_* on ten tables).
--
-- Note: the bare auth.uid() calls inside PL/pgSQL RPC bodies
-- (009_rename_category_rpc.sql, 20260703000003_harden_rename_category.sql) are
-- assignment-once patterns, not per-row policy expressions — out of scope.

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
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
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
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;
