-- 20260820000000_secperf_rpc_rls_fk_hardening.sql
-- SEC3-01 / SEC3-03 / PERF3-01 / PERF3-02 (secperf audit, Aug 20, 2026)
-- Source of truth: docs/plans/SECURITY_PERFORMANCE_AUDIT.md
-- All changes are additive/non-destructive; no table/column drops; no RLS weakening.
-- Applied to hosted project mhfzmgrrtruxuiscvbhm via execute_sql (order: grants, indexes, policies).

-- === SEC3-01: lock down RPC exposure ===
-- The three SECURITY DEFINER functions below are trigger functions (bodies only reference
-- NEW/OLD); they are never invoked by user roles. PostgREST exposes every public function as
-- /rest/v1/rpc/*, so the default EXECUTE grants from PUBLIC were unnecessary surface.
-- Trigger execution runs under the function owner and is unaffected by these revocations.
-- IMPORTANT: the callable-from-RPC grants come from the default PUBLIC grant (acl entry "=X/postgres"),
-- so revoking from the named roles anon/authenticated is insufficient — revoke FROM PUBLIC instead.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_time_spent()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_linked_person()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rename_category(text, text, text, text) FROM PUBLIC;
-- rename_category is the one legitimate RPC; re-grant for authenticated only.
GRANT EXECUTE ON FUNCTION public.rename_category(text, text, text, text) TO authenticated;

-- === PERF3-01 / PERF3-02: covering indexes for unindexed foreign keys ===
-- CREATE INDEX CONCURRENTLY takes no exclusive lock; safe to run during user activity.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_explores_linked_thread_id
  ON public.explores (linked_thread_id);     -- FK explores_linked_thread_id_fkey -> threads.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_logs_task_id
  ON public.session_logs (task_id);          -- FK session_logs_task_id_fkey -> items.id

-- === SEC3-03: consolidate duplicate permissive policies ===
-- push_subscriptions and user_settings each carried 5 overlapping policies: 4 correct
-- per-command split policies (roles {authenticated}, per-row-safe (SELECT auth.uid() AS uid))
-- plus one stale ALL-on-public duplicate. Every command remains fully covered by the split set,
-- so dropping the duplicates is authorization-identical; the other 8 RLS tables already follow
-- this clean pattern. Reversal (only if needed):
-- CREATE POLICY users_own_push_subs ON public.push_subscriptions AS PERMISSIVE FOR ALL TO public
--   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY users_own_settings ON public.user_settings AS PERMISSIVE FOR ALL TO public
--   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS users_own_push_subs ON public.push_subscriptions;
DROP POLICY IF EXISTS users_own_settings ON public.user_settings;
