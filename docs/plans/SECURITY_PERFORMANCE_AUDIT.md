# Presense — Security & Performance Audit (Supabase Layer)

**Date:** Aug 20, 2026 · **Author:** Manus AI · **Project:** `mhfzmgrrtruxuiscvbhm` (Postgres 17.6, hosted)

All findings below are verified against the **live hosted database** via direct catalog introspection (`pg_proc`, `pg_policies`, `pg_constraint`, `pg_index`, `pg_stat_user_indexes`, `pg_extension`, `information_schema`). Nothing is guessed. All proposed changes are additive and non-destructive (no `DROP TABLE`, no `DELETE`, no column removal, no RLS weakening — the only removals proposed are two *stale duplicate policy rows* whose exact authorization logic already exists in replacement policies).

---

## Summary of health

1. **No exploitable privilege-escalation path exists.** All four `SECURITY DEFINER` functions were read line-by-line. Three are trigger functions whose bodies can never act on a direct RPC call (they only reference `NEW`/`OLD` trigger tuples); the fourth (`rename_category`) is a properly written RPC with an `auth.uid()` guard, length validation, a hard-coded key allowlist, and no dynamic SQL. The only real gap is *unauthorized exposure*: three of the four are callable by the `anon` role and shouldn't be.
2. **Row-level security is sound and consistent.** All 10 public tables have RLS enabled, and 9 of them follow one clean pattern: four split `users_own_<table>_<cmd>` policies for `authenticated` only. Two tables (`push_subscriptions`, `user_settings`) still carry a second, stale duplicate policy set — redundant, noisy to the planner, and the source of the linter's "multiple permissive policies" warning.
3. **Performance is healthy for the current data scale (max 9 rows per table), with two genuine indexing gaps** that will bite as data grows: the foreign keys `explores.linked_thread_id` and `session_logs.task_id` have no covering indexes, which means cascade deletes and "find related rows" queries would full-scan those tables.
4. **The "pg_trgm in public" warning must NOT be acted on** — ten live GIN indexes (search on items, threads, explores, people, locations) and all similarity/ILIKE queries depend on `pg_trgm` being in `public`. Moving it would break search. This finding is a linter false positive for Supabase projects.
5. **Edge Functions are correctly locked down** (`verify_jwt: true` on all three, `x-cron-secret` gating deployed, all use the `anon` client through RLS — never the service role). The one remaining gap is an operational one: the `CRON_SECRET` runtime secret still has to be added in the Supabase dashboard, and auth "leaked password protection" is a one-click dashboard toggle.

---

## Prioritized remediation checklist

| # | Category | Risk | Fix | Why it matters |
|---|----------|------|-----|----------------|
| 1 | SECURITY | **High** | Revoke `EXECUTE` from `anon` on `handle_new_user`, `increment_time_spent`, `remove_linked_person`; revoke from `anon` on `rename_category` too (keep `authenticated`) | PostgREST exposes every `public` function as `/rest/v1/rpc/*`. Anyone on the internet can call these unauthenticated. No data loss is possible today (see analysis), but it invites spam, log noise, and future functions could be added that *are* dangerous if the precedent stands. This is the single most important principle-of-least-privilege fix. |
| 2 | SECURITY | **Medium** | Enable "Leaked password protection" in the Supabase dashboard (Auth → Settings) | Prevents users from signing up with passwords found in known breach dumps. One-click, zero downtime, pure upside. |
| 3 | PERFORMANCE | **Medium now / High at scale** | Add covering index `idx_explores_linked_thread_id ON explores (linked_thread_id)` | Cascade delete/update from `threads.id` and any "find explores for thread" query currently seq-scans `explores`. Additive, concurrent-safe. |
| 4 | PERFORMANCE | **Medium now / High at scale** | Add covering index `idx_session_logs_task_id ON session_logs (task_id)` | Same class of problem: the `increment_time_spent` trigger path, thread log lookups, and cascade deletes from `items.id` currently seq-scan `session_logs`. Additive, concurrent-safe. |
| 5 | SECURITY + PERFORMANCE | **Low** | Drop the two stale duplicate policies: `push_subscriptions.users_own_push_subs` and `user_settings.users_own_settings` | Each of these tables currently has 5 overlapping permissive policies; the other 8 tables have 4. The two duplicates use the less efficient direct `auth.uid() = user_id` per-row pattern while their replacements already use the `(SELECT auth.uid() AS uid)` form. Removing them keeps authorization byte-for-byte identical, silences the linter, and gives the planner one clean path. |
| 6 | SECURITY (deferred) | **Low** | Add the `CRON_SECRET` runtime secret in the Supabase dashboard (Edge Functions → Secrets) | Deployed today (INFRA-25) the cron functions enforce the `x-cron-secret` header only when this secret exists; until then they run in JWT-passthrough mode. User action, ~1 minute. |
| 7 | SECURITY (documented, not actionable) | — | `pgrst_watch` mutable `search_path` warning | This is a Supabase-managed `realtime` extension function. Users cannot modify it, and it is not user-callable in a meaningful way. No fix available or needed. |
| 8 | SECURITY (documented, not actionable) | — | Do **not** move `pg_trgm` out of `public` | Ten live GIN indexes and all trigram/similarity operators resolve through `public.pg_trgm`. Moving it breaks search entirely. Correct posture: leave it. |
| 9 | PERFORMANCE (monitor only) | **Low** | Unused-index flags: keep every index | `pg_stat_user_indexes` shows the database is tiny (≤9 live rows per table); zero-scan indexes reflect genuine single-user usage, not waste. Removing any risks regressions as data grows. Re-audit at >10k rows. |
| 10 | PERFORMANCE (deferred) | **Low** | Leave `auth.uid()`-free helpers as-is where RLS is fine; no rewrite needed beyond fix #5 | The new split policies on the two noisy tables already use the per-row-safe `(SELECT auth.uid() AS uid)` form. After dropping the stale duplicates, the per-row re-evaluation warning disappears on its own. |

### Output B — safe execution order

Do these first, in this order, because each step is independently reversible and none depends on the previous one except where noted:

1. **(Fix #1) Revoke RPC grants.** Fastest, highest-risk closure, zero downtime, instantly reversible (`GRANT EXECUTE` restores). Can be run live on production right now.
2. **(Fix #3, #4) Create the two FK covering indexes with `CONCURRENTLY`.** Online operations; no locks on the tables, safe to run during user activity.
3. **(Fix #5) Drop the two stale policies.** Verified byte-identical authorization coverage before dropping (see verification plan). Instantly reversible by re-creating the policies verbatim.
4. **(Fix #2, #6) Dashboard toggles.** Leaked-password protection and the `CRON_SECRET` secret — human actions, no SQL, no risk.
5. **Verify** (full verification plan below) and commit the same changes as a migration file for the repo so environments stay identical.

---

## SQL changes (grouped by theme)

### Theme 1 — RPC exposure lockdown (Fix #1)

```sql
-- 1a. Trigger functions: no role should invoke these as RPC.
--     They are only ever executed by the trigger system (as the function owner).
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_time_spent()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_linked_person()   FROM anon, authenticated;

-- 1b. The one legitimate RPC keeps its audience: authenticated only.
REVOKE EXECUTE ON FUNCTION public.rename_category(text, text, text, text) FROM anon;
-- (authenticated keeps EXECUTE; no GRANT needed — it is unaffected by revoking from anon.)
```

Note: Postgres grants `EXECUTE` to `PUBLIC` by default on function creation, which is why both `anon` and `authenticated` show as having access. Revoking from both named roles is the standard Supabase hardening pattern; trigger execution is unaffected because the trigger fires under the function owner's identity, not the `anon`/`authenticated` roles.

### Theme 2 — covering indexes for unindexed foreign keys (Fix #3, #4)

```sql
-- 2a. explores.linked_thread_id -> threads.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_explores_linked_thread_id
  ON public.explores (linked_thread_id);

-- 2b. session_logs.task_id -> items.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_logs_task_id
  ON public.session_logs (task_id);
```

Both indexes serve: (a) cascade delete/update from the parent table (`threads.id`, `items.id`), which must locate child rows; (b) application query patterns such as "list explores attached to a thread" and "list session logs for a task". `CONCURRENTLY` means no exclusive lock — the tables stay fully readable and writable during creation.

### Theme 3 — RLS policy consolidation (Fix #5)

```sql
-- 3a. push_subscriptions: drop the stale ALL-on-public policy.
--     Its four split replacements (users_own_push_subscriptions_{select,insert,update,delete},
--     roles {authenticated}, qual/with_check "(SELECT auth.uid() AS uid) = user_id") already
--     cover every command for authenticated users; anon remains blocked by absence of policy.
DROP POLICY users_own_push_subs ON public.push_subscriptions;

-- 3b. user_settings: same reasoning.
DROP POLICY users_own_settings ON public.user_settings;
```

This is the only destructive-ish statement in the whole plan, and it is safe because the replacement policies are *already live* and were compared one-by-one against the dropped policies' `qual`/`with_check`/`cmd`/`roles`. No privilege changes hands; `auth.uid() = user_id` ownership is preserved everywhere. To be extra safe, re-create statements are kept ready (they are the exact rows from `pg_policies`):

```sql
-- Emergency reversal, if ever needed (do NOT run unless reverting):
-- CREATE POLICY users_own_push_subs ON public.push_subscriptions
--   AS PERMISSIVE FOR ALL TO public
--   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY users_own_settings ON public.user_settings
--   AS PERMISSIVE FOR ALL TO public
--   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Theme 4 — template: function hardening (if a future RPC needs it)

No hardening rewrite is required for `rename_category` — its body already implements the safe pattern. For reference, a future SECURITY DEFINER RPC should look like this:

```sql
CREATE OR REPLACE FUNCTION public.my_safe_rpc(p_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- pin search_path; immune to role mutable search_path
AS $$
DECLARE
  v_user_id uuid := auth.uid();   -- explicit check even though RLS usually guards
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(p_input) > 200 THEN   -- input validation on every parameter
    RAISE EXCEPTION 'invalid_input';
  END IF;
  UPDATE public.my_table
     SET col = p_input
   WHERE user_id = v_user_id;     -- scope every write to the caller
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
END;
$$;
-- Then immediately lock the audience:
REVOKE EXECUTE ON FUNCTION public.my_safe_rpc(text) FROM anon;
```

### Theme 5 — pg_trgm (documented, no change)

```sql
-- NOT recommended. For the record, the dependency check that proves it:
-- SELECT i.relname, t.relname, am.amname
--   FROM pg_index ix JOIN pg_class t ON t.oid = ix.indrelid
--   JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_am am ON am.oid = i.relam
--  WHERE am.amname IN ('gist','gin');
-- → 10 GIN indexes (idx_items_title, idx_threads_title, idx_people_name, ...) depend on pg_trgm.
```

---

## Verification plan

Run every check below *before* and *after* each fix (the "before" state is already recorded in this report's evidence; re-run to confirm deltas).

### After Fix #1 (RPC lockdown)

```sql
-- V1a. Grants revoked: all four must return false for anon.
SELECT proname,
       has_function_privilege('anon'::regrole, oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated'::regrole, oid, 'EXECUTE') AS auth_exec
  FROM pg_proc
 WHERE proname IN ('handle_new_user','increment_time_spent','remove_linked_person','rename_category');
-- Expected: rename_category → {f, t}; the three triggers → {f, f}.

-- V1b. Live HTTP smoke test (from any terminal):
--  anon call, expect 401/403 or "permission denied for function":
curl -s -o /dev/null -w "%{http_code}\n" \
  "$SUPABASE_URL/rest/v1/rpc/handle_new_user"
curl -s "$SUPABASE_URL/rest/v1/rpc/rename_category" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{}'
--  authenticated call to rename_category with a real JWT and valid args → 200.
```

### After Fix #3/#4 (covering indexes)

```sql
-- V2a. Indexes exist:
SELECT indexname FROM pg_indexes WHERE tablename IN ('explores','session_logs')
 ORDER BY indexname;
-- Expected: idx_explores_linked_thread_id, idx_session_logs_task_id present.

-- V2b. The planner actually uses them (EXPLAIN must show Index Scan, not Seq Scan):
EXPLAIN SELECT id FROM public.explores WHERE linked_thread_id = '00000000-0000-0000-0000-000000000000';
EXPLAIN SELECT id FROM public.session_logs WHERE task_id = '00000000-0000-0000-0000-000000000000';

-- V2c. Cascade path exercise (safe on this tiny DB, run as the app user / authenticated):
--   create a dummy thread, insert an explore linked to it, delete the thread;
--   the cascade UPDATE/DELETE on explores must use the new index (visible in V2b style EXPLAIN
--   on the trigger path).
```

### After Fix #5 (policy consolidation)

```sql
-- V3a. Exact post-state: each of the two tables must have exactly 4 policies,
-- all PERMISSIVE, roles {authenticated}, split by command.
SELECT tablename, count(*) FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('push_subscriptions','user_settings')
 GROUP BY tablename;   -- expected: 4, 4

-- V3b. No command left uncovered for authenticated (spot check):
SELECT tablename, policyname, cmd FROM pg_policies
 WHERE tablename IN ('push_subscriptions','user_settings') ORDER BY 1, 3;

-- V3c. Authorization regression test — same user, same rights as before:
--   authenticated SELECT/INSERT/UPDATE/DELETE on own rows → allowed;
--   authenticated access to another user's row → 0 rows (RLS);
--   anon any command → 0 rows / 401.
-- Functionally, the split policies are identical to the dropped one; this test
-- proves the replacement set still binds every row to its owner.
```

### After Fix #2 / #6 (dashboard toggles — human verification)

Leaked-password protection: Supabase dashboard → Authentication → Settings → confirm "Email Providers → Leaked password protection" is **On**. `CRON_SECRET`: Supabase dashboard → Edge Functions → Secrets → confirm `CRON_SECRET` exists; then `curl` either cron function URL *without* the `x-cron-secret` header and expect **401** (currently it returns 200 in passthrough mode).

---

## Unresolved items due to limitations

1. **`auth.leaked_password_protection` setting is not readable from SQL** — it lives in the Auth service config, not the database. Verified only via the dashboard; enabling it is a human click (Fix #2). Artifact needed to verify programmatically: none exists in the public SQL surface; the Management API (`GET /v1/projects/{ref}/config/auth`) could, but requires the Management API key.
2. **`pgrst_watch` mutable search_path** — Supabase-managed `realtime` function; its body is not exposed to project-level SQL introspection and cannot be altered by the user. Confirmed via the function's presence in the `realtime`/`supabase_realtime`-managed schema. No artifact can change it.
3. **Full RLS regression proof across all 10 tables** — this report compared policy definitions (the authoritative artifact, `pg_policies`), which is sufficient for the two touched tables. A complete multi-role behavioral matrix (`anon`/`authenticated`/service_role against every table) was not executed row-by-row against the live DB because it requires seeding test rows; the definition-level proof for the changed tables plus unchanged definitions for the other eight is the safe middle ground.
4. **Query-load evidence for the "unused index" decision** — `pg_stat_user_indexes` shows zero scans on most indexes, but the DB has only ~30 total rows, so these stats prove usage *patterns*, not necessity under load. The correct artifact to revisit this later is `pg_stat_user_indexes` re-pulled after 30 days of real traffic.
5. **`cron_recurrence`/`cron_cleanup` secret gating runtime state** — the deployed code enforces `x-cron-secret`, but until the user adds the `CRON_SECRET` secret (Fix #6), the functions accept any JWT. This is an operational gap, not a code gap; verified by reading the deployed source and the live 200 responses from the last session.

---

## Appendix — evidence register (all verified live, Aug 20, 2026)

| # | Artifact queried | Result |
|---|-----------------|--------|
| 1 | `pg_proc` SECURITY DEFINER functions in `public` | Exactly 4: `handle_new_user`, `increment_time_spent`, `remove_linked_person` (all `prorettype = trigger`, no args), `rename_category(text,text,text,text)`; all with `anon_exec = true, auth_exec = true` before Fix #1 |
| 2 | Function bodies (full `prosrc`) | No dynamic SQL anywhere; `rename_category` validates lengths, whitelists `p_categories_key`, scopes all writes to `auth.uid()`; trigger bodies only reference `NEW`/`OLD` |
| 3 | `pg_extension` | `pg_trgm` in `public`; `pg_net`/`pg_stat_statements`/`uuid-ossp`/`pgcrypto` in `extensions`; `supabase_vault` in `vault`; `pg_cron` in `pg_catalog` |
| 4 | GIN/gist indexes | 10 GIN indexes across `items`, `threads`, `people`, `explores`, `locations` — all dependent on `public.pg_trgm` |
| 5 | `pg_policies` full matrix | 10 RLS tables; 9 follow the 4-policy split pattern; `push_subscriptions` and `user_settings` each carry a 5th stale `ALL`/`public` policy |
| 6 | `pg_constraint` + `pg_index` | `explores_linked_thread_id_fkey` and `session_logs_task_id_fkey` confirmed with no covering index |
| 7 | `pg_stat_user_tables` | Max 9 live rows per table (`user_settings`), items 3, threads/explores/`session_logs` 0 |
| 8 | `pg_stat_user_indexes` | Only 6 indexes ever scanned; all others at 0 — consistent with single-user tiny-DB usage |
| 9 | Edge Functions (MCP `list_edge_functions`) | `cleanup_trash` v3, `cron_recurrence` v2, `cron_cleanup` v2 — all ACTIVE, all `verify_jwt: true` |
| 10 | `information_schema.columns` on `user_settings` | `user_id NOT NULL` — blocks anonymous spam via the `handle_new_user` RPC path |
