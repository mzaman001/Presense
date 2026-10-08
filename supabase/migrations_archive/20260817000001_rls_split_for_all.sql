-- INFRA-16: split every FOR ALL users_own_* RLS policy into four
-- operation-scoped policies (SELECT / INSERT / UPDATE / DELETE) so
-- Postgres's planner can optimize index usage per operation instead of
-- evaluating one broader expression for every query type (per Supabase's
-- current guidance against FOR ALL).
--
-- Security invariance preserved: every per-operation policy keeps the same
-- (select auth.uid()) = user_id expression the INFRA-15 migration
-- (20260817000000) established — the permitted row set is identical, only
-- the evaluation path per operation changes.
--
-- Supabase's documented gotcha is honored: an UPDATE policy requires a
-- paired SELECT policy on the same table (Postgres must read the pre-update
-- row to evaluate USING). Here every table gets all four policies, so the
-- pairing holds by construction.
--
-- Idempotency: mirrors the live-migration loop structure of
-- 20260703000001 / 20260817000000 — drops any existing users_own_* policy
-- (FOR ALL or per-op), then creates the four scoped ones; handles the
-- legacy policy name from 20260628121249 as well.

DO $$
DECLARE
  t text;
  base text;
BEGIN
  FOREACH t IN ARRAY ARRAY['items','people','threads','explores','locations','push_subscriptions','user_settings','categories','session_logs','ritual_logs'] LOOP
    base := 'users_own_' || t;

    -- Clear any policy in the users_own_* family (FOR ALL or any single-op
    -- variant from a partial run), plus the legacy ritual_logs name.
    DECLARE
      existing record;
    BEGIN
      FOR existing IN
        SELECT policyname FROM pg_policies
        WHERE tablename = t
          AND (policyname = base
            OR policyname LIKE base || '_select'
            OR policyname LIKE base || '_insert'
            OR policyname LIKE base || '_update'
            OR policyname LIKE base || '_delete'
            OR policyname = 'Users can manage their own ritual logs')
      LOOP
        EXECUTE format('DROP POLICY %I ON %I', existing.policyname, t);
      END LOOP;
    END;

    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT  TO authenticated USING ((select auth.uid()) = user_id)', base || '_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT  TO authenticated WITH CHECK ((select auth.uid()) = user_id)', base || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', base || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE  TO authenticated USING ((select auth.uid()) = user_id)', base || '_delete', t);
  END LOOP;

  -- Legacy policy name from 20260628121249_ritual_tracking.sql on ritual_logs.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ritual_logs' AND policyname = 'Users can manage their own ritual logs'
  ) THEN
    DROP POLICY "Users can manage their own ritual logs" ON ritual_logs;
  END IF;
END $$;
